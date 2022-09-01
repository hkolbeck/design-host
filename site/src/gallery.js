async function load(url) {
    if (url.pathname.startsWith('/gallery/')) {
        await loadGalleryPage(url)
    } else if (url.pathname.startsWith('/tag/')) {
        await loadTagPage(url)
    } else {
        console.log(`Unexpected url: ${url}`);
        window.location.href = "https://acab.city/error";
    }
}

async function loadTagPage(url) {
    const tag = url.pathname.replace('/tag/', '')
    const offset = url.searchParams.get('offset')

    const apiResult = await fetchTagPage(tag, offset)
    if (!apiResult) {
        console.log("Page fetch failed");
        window.location.href = "https://acab.city/error";
        return;
    }

    let nextPageLink = null;
    if (apiResult.nextOffset) {
        nextPageLink = `https://acab.city/tag/${tag}?offset=${apiResult.nextOffset}`;
    }

    renderPage(nextPageLink, apiResult.page).catch((err) => {
        console.log(`Error fetching for tag ${tag}`)
        console.log(err);
        window.location.href = "https://acab.city/error";
    });
}


async function loadGalleryPage(url) {
    const pageToken = url.searchParams.get("page");
    const path = url.pathname.replace("/gallery/", "")

    const apiResult = await fetchForPath(path, pageToken);
    if (!apiResult) {
        console.log("Page fetch failed");
        window.location.href = "https://acab.city/error";
        return;
    }

    if (apiResult.page) {
        let nextPageLink = null;
        if (apiResult.nextPage) {
            nextPageLink = `https://acab.city/gallery/${path}?page=${apiResult.nextPage}`;
        }
        renderPage(nextPageLink, apiResult.page).catch((err) => {
            console.log(`Error fetching ${path}`)
            console.log(err);
            window.location.href = "https://acab.city/error";
        });
    } else if (apiResult.contents) {
        renderSingle(apiResult).catch((err) => {
            console.log(`Error fetching ${path}`)
            console.log(err);
            window.location.href = "https://acab.city/error";
        });
    } else {
        console.log(`Unexpected result type from page fetch: ${typeof apiResult}: ${JSON.stringify(apiResult)}`);
        window.location.href = "https://acab.city/error";
    }
}

async function fetchForPath(path, pageToken) {
    if (path.endsWith("/") || pageToken) {
        return await fetchPage(path, pageToken)
    } else {
        return await fetchSingle(path).then(item => {
            if (item) {
                return item
            } else {
                return fetchPage(path + "/", null)
            }
        })
    }
}

function buildItem(idx) {
    const wrapper = document.createElement("div");
    wrapper.id = `gallery-item-wrapper-${idx}`
    wrapper.className = "gallery-item-wrapper"
    wrapper.innerHTML = `
            <div id="gallery-item-${idx}" class="gallery-item">
                <img id="gallery-image-${idx}" class="gallery-image" src="" alt=""/>
                <a id="gallery-folder-${idx}" href="">
                    <img
                            id="gallery-folder-img-${idx}"
                            class="gallery-folder"
                            src="/images/folder.svg"
                            alt="folder"
                    />
                </a>
                <a id="item-link-${idx}" href="">
                    <img
                            id="item-link-img-${idx}"
                            class="item-link-img"
                            src="/images/link.svg"
                            alt="Link"
                    />
                </a>
                <a id="download-${idx}">
                    <img
                            id="download-img-${idx}"
                            class="download"
                            src="/images/download.svg"
                            alt="Download"
                    />
                </a>
            </div>
            <div class="title-wrapper"><span class="gallery-title" id="gallery-title-${idx}"></span></div>`

    return wrapper
}

function buildPage() {
    const gallery = document.getElementById("gallery")
    for (let i = 0; i < 10; i++) {
        gallery.appendChild(buildItem(i))
    }
}

async function fetchSingle(path) {
    const url = `https://acab.city/api/single-item/${path}`
    return apiFetch(url, null)
}

async function fetchPage(path, pageToken) {
    let url = `https://acab.city/api/get-page/${path}`;
    if (url.endsWith('/')) {
        url = url.slice(0, url.length - 1)
    }

    if (pageToken) {
        url += `?page=${pageToken}&count=10`;
    } else {
        url += "?count=11";
    }

    return apiFetch(url, {page: []})
}

async function fetchTagPage(tag, offset) {
    let url = `https://acab.city/api/tag-group-page/${tag}`
    if (offset) {
        url = url + `?offset=${offset}`
    }

    return apiFetch(url, {page: []})
}


async function pdfToPreviewDataUrl(pdfDataUrl, scale) {
    const pdfData = pdfDataUrl.slice(pdfDataUrl.indexOf(",") + 1);
    const pdfBinaryData = Base64Binary.decode(pdfData);
    const loadingTask = pdfjsLib.getDocument(pdfBinaryData);
    const pdf = await loadingTask.promise.catch((err) => {
        console.log(err);
        return null;
    });
    // Fetch the first page.
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({scale: 1.5});
    // Support HiDPI-screens.
    const outputScale = window.devicePixelRatio || scale;

    // Prepare canvas using PDF page dimensions.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    // Render PDF page into canvas context.
    const renderContext = {
        canvasContext: context, transform, viewport,
    };
    await page.render(renderContext).promise;

    return canvas.toDataURL();
}

function textToPreviewDataUrl(textDataUrl) {
    const base64Text = textDataUrl.slice(textDataUrl.indexOf(",") + 1);
    const text = atob(base64Text)
    const parts = []
    for (let i = 0; i < text.length; i += 34) {
        parts.push(text.slice(i, i + 34))
    }

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext('2d');
    canvas.width = 260
    canvas.height = 260

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, 260, 260)

    ctx.fillStyle = "black"
    ctx.textAlign = "left"
    ctx.font = `12px monospace`
    for (let y = 10, i = 0; y < 260 && i < parts.length; y += 14, i++) {
        ctx.fillText(parts[i], 6, y)
    }

    return canvas.toDataURL()
}

async function svgToPreviewDataUrl(svgDataUrl, edgeLen) {
    return new Promise((resolve) => {
        const img = document.createElement("img")
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext('2d')
            ctx.fillStyle = "#FFFFFF"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)

            resolve(canvas.toDataURL("image/ing"))
        }
        img.src = svgDataUrl
    })
}

async function getPreviewDataUrl(contentDataUrl, pdfScale) {
    const preamble = contentDataUrl.slice(0, contentDataUrl.indexOf(","));
    if (preamble.match("image/jpeg") || preamble.match("image/png")) {
        return contentDataUrl;
    } else if (preamble.match("application/pdf")) {
        return await pdfToPreviewDataUrl(contentDataUrl, pdfScale);
    } else if (preamble.indexOf("image/svg+xml") >= 0) {
        return await svgToPreviewDataUrl(contentDataUrl)
    } else if (preamble.match("text/plain")) {
        return textToPreviewDataUrl(contentDataUrl)
    } else {
        console.log(`Unknown mime type in preamble: '${preamble}'`);
        return contentDataUrl;
    }
}

async function dataUrlToBlob(item) {
    return await fetch(item.contents)
        .then((response) => response.blob())
        .then(URL.createObjectURL);
}

async function renderPage(nextPageLink, files) {
    const start = Date.now();

    if (files.length === 0) {
        const nothingHere = document.getElementById("nothing-here")
        nothingHere.style.display = "block"
        return
    }

    const promises = [...Array(10).keys()].map(async i => {
        const wrapper = document.getElementById(`gallery-item-wrapper-${i}`)
        const item = document.getElementById(`gallery-item-${i}`);
        const file = files[i];

        if (file) {
            const img = document.getElementById(`gallery-image-${i}`);
            const title = document.getElementById(`gallery-title-${i}`);
            const download = document.getElementById(`download-${i}`);
            const downloadImg = document.getElementById(`download-img-${i}`);
            const folder = document.getElementById(`gallery-folder-${i}`);
            const folderImg = document.getElementById(`gallery-folder-img-${i}`);
            const link = document.getElementById(`item-link-${i}`)
            const linkImg = document.getElementById(`item-link-img-${i}`)

            if (file.type === "file") {
                const previewDataUrl = await getPreviewDataUrl(file.contents, 1);
                img.onclick = () => {
                    let wrapper = document.createElement("div");
                    wrapper.className = "big-image-wrapper";

                    let backer = document.createElement("div");
                    backer.className = "big-image-backer";
                    wrapper.appendChild(backer);

                    let bigImg = document.createElement("img");
                    bigImg.src = previewDataUrl;
                    bigImg.alt = file.alt;
                    bigImg.className = "big-image";
                    wrapper.appendChild(bigImg);

                    backer.onclick = () => {
                        document.body.removeChild(wrapper);
                    };

                    document.body.appendChild(wrapper);
                };

                img.setAttribute("src", previewDataUrl);
                img.setAttribute("alt", file.alt);
                if (file.blur) {
                    img.style.filter = "blur(10px)"
                }

                title.innerText = file.title;

                const objectURL = await dataUrlToBlob(file);
                download.setAttribute("href", objectURL);
                download.setAttribute("download", item.fileName);
                downloadImg.setAttribute("alt", `Download ${file.title}`);

                link.setAttribute("href", `https://acab.city/gallery/${file.fullPath}`)
                linkImg.setAttribute("alt", `Link to ${file.title}`)

                folder.style.display = "none";
                download.style.display = "block";
                wrapper.style.display = "block";
            } else if (file.type === "directory") {
                download.style.display = "none";
                img.style.display = "none";

                folderImg.setAttribute("alt", `${file.fileName} Folder`);
                folder.setAttribute("href", `https://acab.city/gallery/${encodeURIComponent(file.fullPath)}`);

                title.innerText = file.fileName;

                link.style.display = "none"
                folderImg.style.display = "block";
                wrapper.style.display = "block";
            } else {
                console.log(`Unknown file type: ${file.type}`);
                item.style.display = "none";
            }
        } else {
            item.style.display = "none";
        }
    })

    await Promise.all(promises)

    const gallery = document.getElementById("gallery")
    gallery.style.display = "grid"

    const next = document.getElementById("next-button");
    if (nextPageLink) {
        next.href = nextPageLink
        next.style.display = "block";
    } else {
        next.style.display = "none";
    }
    console.log(`Render completed in ${Date.now() - start}ms`);
}

async function renderSingle(item) {
    const wrapper = document.getElementById("single-item-wrapper")
    const img = document.getElementById("single-image")
    const title = document.getElementById("single-image-title")
    const download = document.getElementById("single-image-download")
    const downloadImg = document.getElementById("single-image-download-img")

    const previewDataURL = await getPreviewDataUrl(item.contents, 10)
    img.setAttribute("src", previewDataURL)
    img.setAttribute("alt", item.alt)

    title.innerText = item.title

    const objectURL = await dataUrlToBlob(item);
    download.setAttribute("href", objectURL);
    download.setAttribute("download", item.fileName);

    console.log(JSON.stringify(item))

    if (item.fileName.endsWith('.pdf') || item.fileName.endsWith('.svg')) {
        downloadImg.setAttribute('src', '/img/save-vector.svg')
    } else {
        downloadImg.setAttribute('src', '/img/save-high-res.svg')
    }

    downloadImg.setAttribute("alt", `Save ${item.title}`)

    wrapper.style.display = "grid"
}

window.onload = () => {
    buildPage();
    load(new URL(window.location.href));
}