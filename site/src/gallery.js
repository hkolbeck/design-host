async function loadPage(url) {
    const gallery = url.searchParams.get("gallery");
    if (!gallery) {
        console.log(`No gallery in URL: ${url.toString()}`);
        window.location.href = "https://acab.city/error";
        return;
    }

    const subDir = url.searchParams.get("sub");
    const pageToken = url.searchParams.get("page");
    const page = await fetchPage(gallery, subDir, pageToken);
    if (!page) {
        console.log("Page fetch failed");
        window.location.href = "https://acab.city/error";
        return;
    }

    await renderPage(gallery, pageToken, page.nextPage, page.page).catch(
        (err) => {
            console.log(err);
        }
    );
}

async function fetchPage(gallery, subDir, pageToken) {
    const start = Date.now();
    let url = `https://acab.city/api/get-page?gallery=${gallery}`;
    if (pageToken) {
        url += `&page=${pageToken}&count=10`;
    } else {
        url += "&count=11";
    }

    if (subDir) {
        url += `&sub=${subDir.replace(" ", "%20")}`;
    }

    return await fetch(url)
        .then(async (resp) => {
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
                return {page: []};
            }
        })
        .catch((err) => {
            console.log(`Error fetching '${url}'`);
            console.log(err);
            return null;
        });
}

async function pdfToPreviewDataUrl(pdfDataUrl) {
    const start = Date.now();
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

    console.log(`PDF=>PNG conversion completed in ${Date.now() - start}ms`);
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

async function renderPage(gallery, currentPage, nextPage, files) {
    const start = Date.now();

    if (files.length === 0) {
        const nothingHere = document.getElementById("nothing-here")
        nothingHere.style.display = "block"
        return
    }

    for (let i = 0; i < 10; i++) {
        const item = document.getElementById(`gallery-item-${i}`);
        const img = document.getElementById(`gallery-image-${i}`);
        const title = document.getElementById(`gallery-title-${i}`);
        const download = document.getElementById(`download-${i}`);
        const downloadImg = document.getElementById(`download-img-${i}`);
        const folder = document.getElementById(`gallery-folder-${i}`);
        const folderImg = document.getElementById(`gallery-folder-img-${i}`);

        if (files[i]) {
            if (files[i].type === "file") {
                let previewDataUrl = await getPreviewDataUrl(files[i].contents);
                img.onclick = () => {
                    let wrapper = document.createElement("div");
                    wrapper.className = "big-image-wrapper";

                    let backer = document.createElement("div");
                    backer.className = "big-image-backer";
                    wrapper.appendChild(backer);

                    let bigImg = document.createElement("img");
                    bigImg.src = previewDataUrl;
                    bigImg.alt = files[i].alt;
                    bigImg.className = "big-image";
                    wrapper.appendChild(bigImg);

                    backer.onclick = () => {
                        document.body.removeChild(wrapper);
                    };

                    document.body.appendChild(wrapper);
                };

                img.setAttribute("src", previewDataUrl);
                img.setAttribute("alt", files[i].alt);
                title.innerText = files[i].title;

                download.setAttribute("href", files[i].contents);
                download.setAttribute("download", files[i].fileName);

                downloadImg.setAttribute("alt", `Download ${files[i].title}`);

                folder.style.display = "none";
                item.style.display = "block";
                download.style.display = "block";
            } else if (files[i].type === "directory") {
                download.style.display = "none";
                img.style.display = "none";

                folderImg.setAttribute("alt", `${files[i].fileName} Folder`);
                folder.setAttribute(
                    "href",
                    `https://acab.city/gallery?gallery=${gallery}&sub=${files[
                        i
                        ].fileName.replace(" ", "%20")}`
                );

                title.innerText = files[i].fileName;

                folderImg.style.display = "block";
                item.style.display = "block";
            } else {
                console.log(`Unknown file type: ${files[i].type}`);
                item.style.display = "none";
            }
        } else {
            item.style.display = "none";
        }
    }

    const next = document.getElementById("next-button");
    if (nextPage) {
        next.href = `https://acab.city/gallery?gallery=${gallery}&page=${nextPage}`;
        next.style.display = "block";
    } else {
        next.style.display = "none";
    }
    console.log(`Render completed in ${Date.now() - start}ms`);
}
