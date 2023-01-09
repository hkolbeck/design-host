function load(url) {
    if (url.pathname.startsWith('/gallery/')) {
        loadGalleryPage(url).catch(err => {
            console.log(`Error loading gallery page for '${url}'`)
            console.log(err)
            window.location.href = "https://acab.city/error";
        })
    } else if (url.pathname.startsWith('/tag/')) {
        loadTagPage(url).catch(err => {
            console.log(`Error loading tag page for '${url}'`)
            console.log(err)
            window.location.href = "https://acab.city/error";
        })
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

const supportedFormats = {
    "pdf": true,
    "png": true,
    "jpg": true,
    "jpeg": true,
}

async function loadGalleryPage(url) {
    const pageToken = url.searchParams.get("page");
    let extension = url.searchParams.get("ext")
    if (extension && extension.length > 4) {
        window.location.href = "https://acab.city/error";
        return
    }

    let path = url.pathname.replace("/gallery/", "")

    // Allow old links
    if (!extension && path.indexOf('.') >= 0) {
        extension = path.slice(path.lastIndexOf('.') + 1)
        path = path.slice(0, path.lastIndexOf('.'))
    }

    const apiResult = await fetchForPath(path, extension, pageToken);
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
            console.log(`Error rendering '${path}'`)
            console.log(err);
            window.location.href = "https://acab.city/error";
        });
    } else if (apiResult.contents) {
        renderSingle(apiResult).catch((err) => {
            console.log(`Error rendering '${path}'`)
            console.log(err);
            window.location.href = "https://acab.city/error";
        });
    } else {
        console.log(`Unexpected result type from page fetch: ${typeof apiResult}: ${JSON.stringify(apiResult)}`);
        window.location.href = "https://acab.city/error";
    }
}

async function fetchTagPage(tag, offset) {
    let url = `https://acab.city/api/tag-group-page/${tag}`
    if (offset) {
        url = url + `?offset=${offset}`
    }

    return apiFetch(url, {page: []})
}

window.onload = () => {
    buildPage();
    load(new URL(window.location.href));
}