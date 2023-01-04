const {Storage} = require('@google-cloud/storage');
const path = require('path')
const fastify = require("fastify")({
    logger: false,
});

const {makeGcsClient} = require("./src/gcs");
const {generatePreviewImage, generateOpengraph} = require("./src/opengraph");

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

const staticPaths = {
    "/": "index.html",
    "/404": "404.html",

    "/fonts/montserrat-regular-webfont.woff": "fonts/montserrat-regular-webfont.woff",
    "/fonts/montserrat-regular-webfont.woff2": "fonts/montserrat-regular-webfont.woff2",

    "/src/gallery.js": "src/gallery.js",
    "/src/base64-binary.js": "src/base64-binary.js"

}

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

let tagGroups = {}
let collection = {}

async function makeFileIndex() {
    const start = Date.now()
    const coll = await gcs.buildCollection()
    tagGroups = coll.tagGroups
    collection = coll.collection

    console.log(`Built file index in ${Date.now() - start}ms`)
}

fastify.get("/images/:img", (request, reply) => {
    reply.sendFile(request.params["img"], path.join(__dirname, "site", "img"))
})

fastify.get("/styles/:style", (request, reply) => {
    reply.sendFile(request.params["style"], path.join(__dirname, "site", "style"))
})

Object.entries(staticPaths).forEach(entry => {
    const [path, file] = entry
    fastify.get(path, (request, reply) => {
        reply.sendFile(file)
    });
})

const canPreview = {
    ".pdf": true,
    ".jpeg": true,
    ".jpg": true,
    ".png": true,
    ".svg": true
}
fastify.get("/gallery/*", (request, reply) => {
    const lastDot = request.url.lastIndexOf(".")
    let sendingPreview = false
    if (lastDot >= 0) {
        const ext = request.url.slice(lastDot)
        if (canPreview[ext] && request.headers["user-agent"]) {
            const userAgent = request.headers["user-agent"]
            let isBot = previewBots.map(bot => userAgent.indexOf(bot) >= 0)
                .reduce((found, thisBot) => found || thisBot)

            if (isBot) {
                sendingPreview = true
                const path = decodeURIComponent(request.url).replace("/gallery/", "")
                generateOpengraph(gcs, path)
                    .then(head => {
                        reply.status(200).send(head);
                    })
                    .catch(err => {
                        console.log(`Error generating preview for ${path}: ${err.message}`)
                        reply.status(404).send()
                    })
            }
        }
    }

    if (!sendingPreview) {
        reply.sendFile("gallery.html")
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
    reply.sendFile("404.html")
})

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
                    const [rawFile, [metadata]] = await Promise.all([gcs.fetchObject(file), file.getMetadata()])
                    if (!metadata.metadata) {
                        metadata.metadata = {}
                    }

                    const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
                    return {
                        type: "file",
                        contents: rawFile,
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

fastify.get("/api/preview/*", (request, reply) => {
    const path = decodeURIComponent(request.url).replace("/api/preview/", "")
        .replace(/\?.*/, '/').replace(/\.png$/, "")
    let start = Date.now();
    generatePreviewImage(gcs, path)
        .then(({mime, contents}) => {
            console.log(`Preview generated in ${Date.now() - start}ms`)
            if (!contents) {
                console.log(`Couldn't generate preview for ${path}`);
                reply.status(404).send()
                return
            }

            reply.header("Content-Type", mime)
            reply.status(200).send(contents)
        })
        .catch(err => {
            console.log(err)
            reply.status(404).send()
        })
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

    console.log(`Got s=${JSON.stringify(searchTerms)} o=${offset} t=${JSON.stringify(types)}`)

    const fullResults = [];
    for (let term of searchTerms) {
        let rightType = (collection[term] || [])
            .filter(item => types.length === 0 || any(types, t => item.path.startsWith(t)))
        fullResults.push(...rightType);
    }

    console.log(`Found ${fullResults.length} non-deduped results`)

    let counts = {};
    let pathTypes = {};
    for (let item of fullResults) {
        pathTypes[item.path] = item.type

        if (!counts[item.path]) {
            counts[item.path] = 0
        }

        counts[item.path]++
    }

    console.log(JSON.stringify(counts))
    console.log(JSON.stringify(pathTypes))

    let paths = Object.entries(counts);
    paths.sort((a, b) => b[1] - a[1])
    const pageContents = paths.slice(offset, offset + PAGE_LEN)
        .map(entry => entry[0])
        .map(path => {
            return {type: pathTypes[path], path}
        })

    console.log(JSON.stringify(pageContents))

    gcs.fetchBatch(pageContents)
        .then(page => {
            const resp = {page}
            if (offset + PAGE_LEN < fullResults.length) {
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