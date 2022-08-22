function changePage(gallery, currentToken, nextToken) {
    clearPage()
}

function clearPage() {
    for (let i = 0; i < 10; i++) {
        const img = document.getElementById(`gallery-image-${i}`);
        const title = document.getElementById(`gallery-title-${i}`)
        img.style.display = "hidden"
        title.innerText = ""
    }
}

function getPreviewDataUrl(pdfBase64) {

}

function renderPage(gallery, files, currentToken, nextToken) {
    for (let i = 0; i < 10; i++) {
        const img = document.getElementById(`gallery-image-${i}`);
        const title = document.getElementById(`gallery-title-${i}`)
        if (files[i]) {
            let previewDataUrl = getPreviewDataUrl(files[i]);
            img.onclick = () => {
                let div = document.createElement("div");
                let bigImg = document.createElement("img");
            }

            img.setAttribute("src", previewDataUrl)
            img.setAttribute("alt", files[i].alt)
            title.innerText = files[i].title

            img.style.display = "block"
            title.style.display = "block"
        } else {
            img.style.display = "hidden"
            title.style.display = "hidden"
        }
    }

    const prev = document.getElementById("previous-button")
    if (currentToken) {
        prev.href = `https://acab.city/gallery?gallery=${gallery}&page=${currentToken}`
    } else {
        prev.style.display = "hidden"
    }

    const next = document.getElementById("next-button")
    if (nextToken) {
        next.href = `https://acab.city/gallery?gallery=${gallery}&page=${nextToken}`
    } else {
        next.style.display = "hidden"
    }
}