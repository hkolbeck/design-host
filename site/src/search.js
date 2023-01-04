async function loadSearchPage(url) {
    const search = url.searchParams.get("s");
    if (!search) {
        console.error("User got to search page without a search specified")
        window.location.href = "https://acab.city/error";
        return;
    }

    let apiUrl = `https://acab.city/api/search-page?s=${search}`

    const offset = url.searchParams.get("offset");
    if (offset) {
        apiUrl = apiUrl + `&offset=${offset}`
    }

    const types = url.searchParams.get('types')
    if (types) {
        apiUrl = apiUrl + `&types=${types}`
    }

    let {page, nextOffset} = await apiFetch(apiUrl, {page: []});
    let nextUrl = null
    if (nextOffset) {
        nextUrl = `https://acab.city/search?s=${search}&offset=${nextOffset}`
        if (types) {
            nextUrl = nextUrl + `&types=${types}`
        }
    }

    renderPage(nextUrl, page).catch((err) => {
        console.log(`Error rendering '${apiUrl}'`)
        console.log(err);
        window.location.href = "https://acab.city/error";
    });
}

window.onload = () => {
    buildPage();
    loadSearchPage(new URL(window.location.href)).catch((err) => {
        console.log(`Error loading '${window.location.href}'`)
        console.log(err);
        window.location.href = "https://acab.city/error";
    });
}