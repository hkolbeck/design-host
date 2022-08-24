async function loadPage(url) {

    const pageToken = url.searchParams.get("page");
    const path = new URL(url).pathname.replace("/gallery/", "")

    const apiResult = await fetchForPath(path, pageToken);
    if (!apiResult) {
        console.log("Page fetch failed");
        window.location.href = "https://acab.city/error";
        return;
    }

    if (apiResult.page) {
        renderPage(path, pageToken, apiResult.nextPage, apiResult.page).catch(
            (err) => {
                console.log(`Error fetching ${path}`)
                console.log(err);
                window.location.href = "https://acab.city/error";
            }
        );
    } else if (apiResult.contents) {
        renderSingle(apiResult).catch(
            (err) => {
                console.log(`Error fetching ${path}`)
                console.log(err);
                window.location.href = "https://acab.city/error";
            }
        );
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

async function apiFetch(url, def) {
    const start = Date.now()
    return await fetch(url, {
        headers: {
            "Accept-Encoding": "gzip"
        }
    }).then(async (resp) => {
        if (resp.ok) {
            let json = await resp.json();
            console.log(`Fetch completed in ${Date.now() - start}ms`);
            return json;
        } else {
            console.log(
                `Failed to fetch '${url}': ${resp.status} ${
                    resp.statusText
                }: ${await resp.text()}`
            );
            return def;
        }
    }).catch((err) => {
        console.log(`Error fetching '${url}'`);
        console.log(err);
        return null;
    })
}

async function pdfToPreviewDataUrl(pdfDataUrl) {
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
    const outputScale = window.devicePixelRatio || 1;

    // Prepare canvas using PDF page dimensions.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    // Render PDF page into canvas context.
    const renderContext = {
        canvasContext: context,
        transform,
        viewport,
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

async function getPreviewDataUrl(contentDataUrl) {
    const preamble = contentDataUrl.slice(0, contentDataUrl.indexOf(","));
    if (preamble.match("image/jpeg") || preamble.match("image/png")) {
        return contentDataUrl;
    } else if (preamble.match("application/pdf")) {
        return await pdfToPreviewDataUrl(contentDataUrl);
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

async function renderPage(path, currentPage, nextPage, files) {
    const start = Date.now();

    if (files.length === 0) {
        const nothingHere = document.getElementById("nothing-here")
        nothingHere.style.display = "block"
        return
    }

    const promises = [...Array(10).keys()].map(async i => {
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
                let previewDataUrl = await getPreviewDataUrl(file.contents);
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
                title.innerText = file.title;

                const objectURL = await dataUrlToBlob(file);
                download.setAttribute("href", objectURL);
                download.setAttribute("download", item.fileName);
                downloadImg.setAttribute("alt", `Download ${file.title}`);

                link.setAttribute("href", `https://acab.city/gallery/${file.fullPath}`)
                linkImg.setAttribute("alt", `Link to ${file.title}`)

                folder.style.display = "none";
                item.style.display = "grid";
                download.style.display = "block";
            } else if (file.type === "directory") {
                download.style.display = "none";
                img.style.display = "none";

                folderImg.setAttribute("alt", `${file.fileName} Folder`);
                folder.setAttribute(
                    "href",
                    `https://acab.city/gallery/${encodeURIComponent(file.fullPath)}`
                );

                title.innerText = file.fileName;

                folderImg.style.display = "block";
                item.style.display = "grid";
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
    if (nextPage) {
        next.href = `https://acab.city/gallery/${path}&page=${nextPage}`;
        next.style.display = "block";
    } else {
        next.style.display = "none";
    }
    console.log(`Render completed in ${Date.now() - start}ms`);
}

async function renderSingle(item) {
    const wrapper = document.getElementById("single-item-wrapper")
    const img = document.getElementById("single-image")
    const download = document.getElementById("single-image-download")
    const downloadImg = document.getElementById("single-image-download-img")

    const previewDataURL = await getPreviewDataUrl(item.contents)
    img.setAttribute("src", previewDataURL)
    img.setAttribute("alt", item.alt)

    const objectURL = await dataUrlToBlob(item);
    download.setAttribute("href", objectURL);
    download.setAttribute("download", item.fileName);
    downloadImg.setAttribute("alt", `Save ${item.title}`)

    wrapper.style.display = "grid"
}