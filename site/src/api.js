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
            console.log(`Failed to fetch '${url}': ${resp.status} ${resp.statusText}: ${await resp.text()}`);
            return def;
        }
    }).catch((err) => {
        console.log(`Error fetching '${url}'`);
        console.log(err);
        return null;
    })
}
