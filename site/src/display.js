async function fetchForPath(path, extension, pageToken) {
    if (path.endsWith("/") || pageToken) {
        return await fetchPage(path, pageToken)
    } else {
        return await fetchSingle(path, extension).then(item => {
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
            <div class="title-wrapper"><span class="gallery-title" id="gallery-title-${idx}"></span></div>
            <div id="gallery-author-${idx}" class="author"></div>`

    return wrapper
}

const PAGE_LEN = 10;
function buildPage() {
    const gallery = document.getElementById("gallery")
    for (let i = 0; i < PAGE_LEN; i++) {
        gallery.appendChild(buildItem(i))
    }

    const nextButton = document.createElement("img")
    nextButton.src = "/images/next-page.svg"
    nextButton.alt = "Next page"
    nextButton.className = "link-button"

    const nextLink = document.createElement("a")
    nextLink.id = "next-button"
    nextLink.appendChild(nextButton)

    gallery.appendChild(nextLink)
}

async function fetchSingle(path, extension) {
    if (!extension) {
        return null
    }

    const url = `https://acab.city/api/single-item/${path}.${extension}`
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

const POSITIONS = Array.from(Array(PAGE_LEN).keys());

async function renderPage(nextPageLink, files) {
    if (files.length === 0) {
        const nothingFound = document.getElementById("nothing-found")
        nothingFound.style.display = "block"
        return
    }

    const gallery = document.getElementById("gallery")
    gallery.style.display = "grid"

    const promises = POSITIONS.map(async i => {
        const wrapper = document.getElementById(`gallery-item-wrapper-${i}`)
        const item = document.getElementById(`gallery-item-${i}`);
        const file = files[i];

        if (file) {
            const img = document.getElementById(`gallery-image-${i}`);
            const title = document.getElementById(`gallery-title-${i}`);
            const author = document.getElementById(`gallery-author-${i}`)
            const download = document.getElementById(`download-${i}`);
            const downloadImg = document.getElementById(`download-img-${i}`);
            const folder = document.getElementById(`gallery-folder-${i}`);
            const folderImg = document.getElementById(`gallery-folder-img-${i}`);
            const link = document.getElementById(`item-link-${i}`)
            const linkImg = document.getElementById(`item-link-img-${i}`)

            if (file.type === "file") {
                let browsePath = `/images/browse/${file.fullPath}.png`;
                img.onclick = () => {
                    let wrapper = document.createElement("div");
                    wrapper.className = "big-image-wrapper";

                    let backer = document.createElement("div");
                    backer.className = "big-image-backer";
                    wrapper.appendChild(backer);

                    let bigImg = document.createElement("img");
                    bigImg.src = browsePath;
                    bigImg.alt = file.alt;
                    bigImg.className = "big-image";
                    wrapper.appendChild(bigImg);

                    backer.onclick = () => {
                        document.body.removeChild(wrapper);
                    };

                    document.body.appendChild(wrapper);
                };

                img.setAttribute("src", browsePath)
                img.setAttribute("alt", file.alt);
                if (file.blur) {
                    img.style.filter = "blur(10px)"
                }

                title.innerText = file.title;
                author.innerText = getAuthor(file)

                download.setAttribute("href", `https://acab.city/download/${file.fullPath}`);
                download.setAttribute("download", file.fileName);
                downloadImg.setAttribute("alt", `Download ${file.title}`);

                let extension = file.fullPath.slice(file.fullPath.lastIndexOf('.') + 1)
                let strippedPath = file.fullPath.slice(0, file.fullPath.lastIndexOf('.'));
                link.setAttribute("href", `https://acab.city/gallery/${strippedPath}?ext=${extension}`)
                linkImg.setAttribute("alt", `Link to ${file.title}`)

                folder.style.display = "none";
                download.style.display = "block";
                wrapper.style.visibility = "visible";
            } else if (file.type === "directory") {
                download.style.display = "none";
                img.style.display = "none";

                folderImg.setAttribute("alt", `${file.fileName} Folder`);
                folder.setAttribute("href", `https://acab.city/gallery/${encodeURIComponent(file.fullPath)}`);

                title.innerText = file.fileName;

                link.style.display = "none"
                folderImg.style.display = "block";
                wrapper.style.visibility = "visible";
            } else {
                console.log(`Unknown file type: ${file.type}`);
                item.style.display = "none";
            }
        } else {
            item.style.display = "none";
        }
    })

    await Promise.all(promises)

    const next = document.getElementById("next-button");
    if (nextPageLink) {
        next.href = nextPageLink
        next.style.display = "block";
    } else {
        next.style.display = "none";
    }
}

async function renderSingle(item) {
    const wrapper = document.getElementById("single-item-wrapper")
    const img = document.getElementById("single-image")
    const title = document.getElementById("single-image-title")
    const author = document.getElementById("single-image-author")
    const download = document.getElementById("single-image-download")
    const downloadImg = document.getElementById("single-image-download-img")

    img.setAttribute("src", `/images/browse/${item.fullPath}.png`)
    img.setAttribute("alt", item.alt)

    title.innerText = item.title
    author.innerText = getAuthor(item)

    download.setAttribute("href", `/download/${item.fullPath}`);
    download.setAttribute("download", item.fileName);

    if (item.fullPath.endsWith('.pdf')) {
        downloadImg.setAttribute('src', '/images/save-pdf.svg')
    } else if (item.fullPath.endsWith('.svg')) {
        downloadImg.setAttribute('src', '/images/save-svg.svg')
    } else {
        downloadImg.setAttribute('src', '/images/save-high-res.svg')
    }

    downloadImg.setAttribute("alt", `Save ${item.title}`)

    if (item.license) {
        let custom = document.getElementById("custom-license");
        custom.innerText = item.license
        custom.style.display = "block"
    } else if (item.notOurs) {
        document.getElementById("unknown-license").style.display = "block";
    } else {
        document.getElementById("cc0").style.display = "block";
    }

    wrapper.style.display = "grid"
}

function getAuthor(item) {
    let author = "Laser Bloc"
    if (item.author) {
        author = item.author
    } else if (item.notOurs) {
        author = "Anonymous"
    }

    return `By ${author}`
}