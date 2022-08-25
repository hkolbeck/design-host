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

const previewBots = {
    "facebot": true,
    "Twitterbot": true,
    "Slackbot-LinkExpanding": true
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
        if (canPreview[ext]) {
            const userAgent = request.headers["user-agent"].match(/^([\w-]+)/)
            console.log(`User-Agent: ${JSON.stringify(userAgent)}`)
            if (userAgent) {
                if (previewBots[userAgent[0]]) {
                    const path = decodeURIComponent(request.url).replace("/gallery/", "")
                    sendingPreview = true
                    generateOpengraph(gcs, path)
                        .then(head => reply.status(200).send(head))
                        .catch(err => {
                            console.log(`Error generating preview for ${path}: ${err.message}`)
                            reply.status(404).send()
                        })
                }
            }
        }
    }

    if (!sendingPreview) {
        reply.sendFile("gallery.html")
    }
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
                        fullPath: file.name.replace(/-$/, ""),
                        fileName: file.name.replace(path, "").replace(/-$/, "")
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
        .replace(/\?.*/, '/')
    generatePreviewImage(gcs, path)
        .then(({mime, contents}) => {
            if (!contents) {
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