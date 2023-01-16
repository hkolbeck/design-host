const {Storage} = require('@google-cloud/storage');
const path = require('path')
const fastify = require("fastify")({
    logger: false,
});

const {makeGcsClient} = require("./src/gcs");
const {generateOpengraphHtml} = require("./src/opengraph");

const config = {
    bucket: process.env.BUCKET,
    port: process.env.PORT,
    host: process.env.HOST,
}

process.on('uncaughtException', function (exception) {
    console.log(exception);
});

fastify.register(require('@fastify/compress'))

fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'site')
})

const storage = new Storage();
const gcs = makeGcsClient(storage.bucket(config.bucket))

let tagGroups = {}
let collection = {}

async function makeFileIndex() {
    const start = Date.now()
    const coll = await gcs.buildCollection()
    tagGroups = coll.tagGroups
    collection = coll.collection

    console.log(`Built file index in ${Date.now() - start}ms`)
}

fastify.get("/images/*", (request, reply) => {
    let imgPath = request.url.replace('/images/', '')
    reply.sendFile(imgPath, path.join(__dirname, "site", "img"))
})

fastify.get("/styles/:style", (request, reply) => {
    reply.sendFile(request.params["style"], path.join(__dirname, "site", "style"))
})

const staticPaths = {
    "/": "index.html",
    "/404": "404.html",
    "/robots.txt": "robots.txt",
    "/favicon.ico": "img/favicon.ico",

    "/fonts/montserrat-regular-webfont.woff": "fonts/montserrat-regular-webfont.woff",
    "/fonts/montserrat-regular-webfont.woff2": "fonts/montserrat-regular-webfont.woff2",

    "/src/gallery.js": "src/gallery.js",
    "/src/base64-binary.js": "src/base64-binary.js"
}

Object.entries(staticPaths).forEach(entry => {
    const [path, file] = entry
    fastify.get(path, (request, reply) => {
        reply.sendFile(file)
    });
})

const previewBots = [
    "facebot",
    "facebookexternalhit",
    "Twitterbot",
    "Slackbot-LinkExpanding",
    "Googlebot-Image",
    "Iframely",
    "node-fetch",
    "Mastodon",
    "Discordbot",
    "redditbot",
    "Semanticbot",
    "PaperLiBot",
    "Akkoma",
    "Pleroma"
]

const canPreview = {
    "pdf": true,
    "jpeg": true,
    "jpg": true,
    "png": true,
    "svg": true
}
fastify.get("/gallery/*", (request, reply) => {
    let ext = request.query["ext"];
    let sendingPreview = false
    if (ext && canPreview[ext] && request.headers["user-agent"]) {
        const userAgent = request.headers["user-agent"]
        let isBot = previewBots.map(bot => userAgent.indexOf(bot) >= 0)
            .reduce((found, thisBot) => found || thisBot)

        if (isBot) {
            sendingPreview = true
            let path = decodeURIComponent(request.url).replace("/gallery/", "")
            path = path.slice(0, path.lastIndexOf('?'))
            generateOpengraphHtml(gcs, path, ext)
                .then(head => {
                    reply.status(200).send(head);
                })
                .catch(err => {
                    console.log(`Error generating preview for ${path}: ${err.message}`)
                    reply.status(404).send()
                })
        }
    }

    if (!sendingPreview) {
        reply.sendFile("gallery.html")
    }
})

fastify.get("/download/*", (request, reply) => {
    let path = decodeURIComponent(request.url.replace('/download/', ''))
    console.log(`Downloading '${path}'`)
    let {mime, contents} = gcs.fetchObjectRaw(path)
    if (contents) {
        reply.header("Content-Type", mime)
        reply.status(200).send(contents)
    } else {
        console.log(`Failed to find object to download: '${path}'`)
        reply.status(404).send()
    }
})

fastify.get("/tag/*", (request, reply) => {
    reply.sendFile("gallery.html")
})

fastify.get("/search", (request, reply) => {
    reply.sendFile("search.html")
})

fastify.get("/error", (request, reply) => {
    reply.sendFile("error.html")
});

fastify.setNotFoundHandler((request, reply) => {
    console.log(`404: ${request.url}`)
    reply.sendFile("404.html")
})

goodbye(fastify, "/components/com_jnews/includes/openflashchart/php-ofc-library/ofc_upload_image.php")
goodbye(fastify, "/apis/apps/v1/namespaces/kube-system/daemonsets")
goodbye(fastify, "/actuator/gateway/routes")
goodbye(fastify, "/wp-config.inc")
goodbye(fastify, "/wp-config.old")
goodbye(fastify, "/wp-config.php.bak")
goodbye(fastify, "/wp-config.php.dist")
goodbye(fastify, "/wp-config.php.inc")
goodbye(fastify, "/wp-config.php.old")
goodbye(fastify, "/wp-config.php~")
goodbye(fastify, "/wp-config.php.txt")
goodbye(fastify, "/wp-config.txt")
goodbye(fastify, "/phpinfo.php")
goodbye(fastify, "/.env")
goodbye(fastify, "/php.php")
goodbye(fastify, "/info.php")
goodbye(fastify, "/metrics")
goodbye(fastify, "/v2/")
goodbye(fastify, "/sitemap.xml")
goodbye(fastify, "/sftp-config.json")
goodbye(fastify, "/.vscode/sftp.json")
goodbye(fastify, "/wp-includes/ID3/license.txt")
goodbye(fastify, "/feed/")
goodbye(fastify, "/xmlrpc.php?rsd")
goodbye(fastify, "/blog/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/web/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/wordpress/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/wp/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/2020/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/2019/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/2021/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/shop/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/wp1/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/test/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/site/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/cms/wp-includes/wlwmanifest.xml")
goodbye(fastify, "/remote/fgt_lang?lang=/../../../..//////////dev/  ")
goodbye(fastify, "/widget/addnow.js")
goodbye(fastify, "/temp.php")
goodbye(fastify, "/old_phpinfo.php")
goodbye(fastify, "/infos.php")
goodbye(fastify, "/linusadmin-phpinfo.php")
goodbye(fastify, "/php-info.php")
goodbye(fastify, "/dashboard/phpinfo.php")
goodbye(fastify, "/_profiler/phpinfo.php")
goodbye(fastify, "/_profiler/phpinfo")
goodbye(fastify, "/HNAP1/")
goodbye(fastify, "/infophp.php")
goodbye(fastify, "/php_info.php")
goodbye(fastify, "/test.php")
goodbye(fastify, "/i.php")
goodbye(fastify, "/asdf.php")
goodbye(fastify, "/pinfo.php")
goodbye(fastify, "/phpversion.php")
goodbye(fastify, "/time.php")
goodbye(fastify, "/index.php")
goodbye(fastify, "/api/v2/cmdb/system/admin/admin")
goodbye(fastify, "/.git/config")
goodbye(fastify, "/mifs/.;/services/LogService")
goodbye(fastify, "/Autodiscover/Autodiscover.xml")

function goodbye(fastify, path) {
    fastify.get(path, (request, reply) => {
        setTimeout(() => {
            reply.header("Location", "https://zombo.com")
            reply.status(301).send()
        }, Math.random() * 3000 + 2000)
    })
}

fastify.setErrorHandler((error, request, reply) => {
    console.log(`Error serving '${request.url}'`)
    console.log(error)
    reply.sendFile("error.html")
})

fastify.get("/api/get-page/*", (request, reply) => {
    const path = decodeURIComponent(request.url).replace("/api/get-page/", "")
        .replace(/\?.*/, '/')
    const pageToken = request.query['page']

    const listStart = Date.now()
    gcs.listDirectory(path, pageToken)
        .then(async listResp => {
            console.log(`List directory time: ${Date.now() - listStart}ms`)
            if (!listResp) {
                reply.status(400).send({error: "Couldn't parse provided page token"})
                return
            }

            let {files, nextPage} = listResp
            files = files.filter(f => !f.name.endsWith(path))
            if (!files || files.length === 0) {
                reply.status(404).send()
                return
            }

            const fetchStart = Date.now()
            const promises = files.filter(f => !f.name.endsWith("/")).map(async file => {
                if (file.name.endsWith("-")) {
                    return {
                        type: "directory",
                        fullPath: file.name.replace(/-$/, "").replace("0000", ""),
                        fileName: file.name.replace(path, "").replace(/-$/, "").replace("0000", "")
                    }
                } else {
                    const [metadata] = await file.getMetadata()
                    if (!metadata.metadata) {
                        metadata.metadata = {}
                    }

                    const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
                    return {
                        type: "file",
                        fileName: fileName,
                        fullPath: file.name,
                        alt: metadata.metadata["alt"] || "No alt text found",
                        title: metadata.metadata["title"] || fileName,
                        blur: metadata.metadata["blur"] === "true"
                    }
                }
            })

            const pageItems = await Promise.all(promises)
            console.log(`Fetch time: ${Date.now() - fetchStart}ms`)

            const body = {
                page: pageItems,
                nextPage: nextPage
            }

            reply.status(200).send(body)
        })
        .catch(err => {
            console.log(`Error getting page for '${path}' page: '${pageToken}'`)
            console.log(err)
            reply.status(500).send({error: "Internal server error"})
        })
})

fastify.get("/api/single-item/*", (request, reply) => {
    const path = decodeURIComponent(request.url).replace("/api/single-item/", "")

    gcs.fetchPath(path)
        .then(response => {
            if (response) {
                reply.status(200).send(response)
            } else {
                console.log(`Nothing single found for ${path}`)
                reply.status(404).send()
            }
        })
        .catch(err => {
            console.log(err)
            reply.status(500).send({error: "Internal server error"})
        })
})

// Serves opengraph previews to accommodate old links
fastify.get("/api/preview/*", (request, reply) => {
    let previewPath = decodeURIComponent(request.url.replace('/preview/', ''))
    console.log(`Returning preview for '${previewPath}'`)
    reply.sendFile(previewPath, path.join(__dirname, "site", "img", "opengraph"))
})

fastify.get("/preview/*", (request, reply) => {
    let previewPath = decodeURIComponent(request.url.replace('/preview/', ''))
    console.log(`Returning preview for '${previewPath}'`)
    reply.sendFile(previewPath, path.join(__dirname, "site", "img", "opengraph"))
})

fastify.get("/api/tag-groups", (request, reply) => {
    reply.status(200).send(Object.keys(tagGroups).sort())
})

const PAGE_LEN = 10;
fastify.get("/api/tag-group-page/:tag", (request, reply) => {
    const tag = request.params["tag"]
    if (!tag) {
        reply.status(400).send({error: "Missing tag in path"})
        return
    }

    const offset = parseInt(request.query["offset"] || "0")

    const tagged = tagGroups[tag] || []
    const pageContents = tagged.slice(offset, offset + PAGE_LEN)
    gcs.fetchBatch(pageContents)
        .then(page => {
            const resp = {page}
            if (offset + PAGE_LEN < tagged.length) {
                resp.nextOffset = offset + PAGE_LEN
            }

            reply.status(200).send(resp)
        })
        .catch(err => {
            console.log(`Error fetching batch for tag: '${tag}' and offset ${offset}`)
            console.log(err)
            reply.status(500).send({error: "Internal server error"})
        })
})

fastify.get("/api/search-page", (request, reply) => {
    const search = decodeURIComponent(request.query["s"] || "");
    if (!search) {
        reply.status(400).send({error: "No search specified"})
        return
    }

    const searchTerms = search.replace(/[^_a-zA-Z\d\s]/g, "")
        .split(/\s+/g)
        .filter(w => !!w);
    const offset = parseInt(request.query["offset"] || "0")
    const types = decodeURIComponent(request.query["types"] || "")
        .split(',')
        .filter(t => t.length > 0)

    console.log(`Searching for s=${JSON.stringify(searchTerms)} o=${offset} t=${JSON.stringify(types)}`)

    const fullResults = [];
    for (let term of searchTerms) {
        let rightType = (collection[term] || [])
            .filter(item => types.length === 0 || any(types, t => item.path.startsWith(t)))
        fullResults.push(...rightType);
    }

    let counts = {};
    let pathTypes = {};
    for (let item of fullResults) {
        pathTypes[item.path] = item.type

        if (!counts[item.path]) {
            counts[item.path] = 0
        }

        counts[item.path]++
    }

    let paths = Object.entries(counts);
    paths.sort((a, b) => b[1] - a[1])
    const pageContents = paths.slice(offset, offset + PAGE_LEN)
        .map(entry => entry[0])
        .map(path => {
            return {type: pathTypes[path], path}
        })


    gcs.fetchBatch(pageContents)
        .then(page => {
            const resp = {page}
            if (offset + PAGE_LEN < paths.length) {
                resp.nextOffset = offset + PAGE_LEN
            }

            reply.status(200).send(resp)
        })
        .catch(err => {
            console.log(`Error fetching batch for search: '${search}' and offset ${offset}`)
            console.log(err)
            reply.status(500).send({error: "Internal server error"})
        })
})

function any(arr, pred) {
    for (let item of arr) {
        if (pred(item)) {
            return true
        }
    }

    return false
}

fastify.get("/health", (request, reply) => reply.status(200).send())

fastify.listen({port: config.port, host: config.host}, function (err, address) {
    if (err) {
        fastify.log.error(err);
        console.log(err)
        process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
});

makeFileIndex().catch(e => {
    console.error("Failed to build file index");
    console.error(e);
})

setInterval(
    () => makeFileIndex().catch(e => {
        console.error("Failed to build file index");
        console.error(e);
    }),
    5 * 60 * 1000
)