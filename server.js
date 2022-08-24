const {Storage} = require('@google-cloud/storage');
const path = require('path')
const fastify = require("fastify")({
    logger: false,
});

const {makeGcsClient} = require("./src/gcs");

const config = {
    bucket: process.env.BUCKET,
    port: process.env.PORT,
}

process.on('uncaughtException', function (exception) {
    console.log(exception);
});

fastify.register(require('@fastify/compress'))

fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'site')
})

const storage = new Storage();
const gcs = makeGcsClient(storage, config.bucket)

const galleryPaths = {
    stickers: 'stickers/',
    jewelry: 'jewelry/',
    stencils: 'stencils/',
    flyers: 'flyers/',
    signage: 'signage/'
}

const staticPaths = {
    "/": "index.html",
    "/gallery": "gallery.html",
    "/404": "404.html",

    "/fonts/montserrat-regular-webfont.woff": "fonts/montserrat-regular-webfont.woff",
    "/fonts/montserrat-regular-webfont.woff2": "fonts/montserrat-regular-webfont.woff2",

    "/style/common.css": "style/common.css",
    "/style/gallery.css": "style/gallery.css",
    "/style/index.css": "style/index.css",

    "/images/acab-dot-city.png": "img/acab-dot-city.png",
    "/images/acab-dot-city.svg": "img/acab-dot-city.svg",
    "/images/download.svg": "img/download.svg",
    "/images/email.svg": "img/email.svg",
    "/images/instagram.svg": "img/instagram.svg",
    "/images/next-page.svg": "img/next-page.svg",
    "/images/twitter.svg": "img/twitter.svg",
    "/images/stickers.svg": "img/stickers.svg",
    "/images/jewelry.svg": "img/jewelry.svg",
    "/images/signage.svg": "img/signage.svg",
    "/images/flyers.svg": "img/flyers.svg",
    "/images/stencils.svg": "img/stencils.svg",
    "/images/folder.svg": "img/folder.svg",
    "/images/favicon.ico": "img/favicon.png",

    "/src/gallery.js": "src/gallery.js",
    "/src/base64-binary.js": "src/base64-binary.js"

}

Object.entries(staticPaths).forEach(entry => {
    const [path, file] = entry
    fastify.get(path, (request, reply) => {
        reply.sendFile(file)
    });
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

fastify.get("/api/get-page", (request, reply) => {
    const pageToken = request.query['page']
    const subGallery = request.query['gallery']
    const subDir = request.query['sub']
    if (!galleryPaths[subGallery]) {
        console.log(`No path found for '${subGallery}'`)
        reply.status(400).send({error: `Unknown gallery: '${subGallery}'`})
        return
    }

    const listStart = Date.now()
    gcs.listDirectory(galleryPaths[subGallery] + (subDir ? subDir + "/" : ""), pageToken)
        .then(async listResp => {
            console.log(`List directory time: ${Date.now() - listStart}ms`)
            if (!listResp) {
                reply.status(400).send({error: "Couldn't parse provided page token"})
                return
            }

            let {files, nextPage} = listResp
            files = files.filter(f => !f.name.endsWith(galleryPaths[subGallery]) && !f.name.endsWith(subDir))
            if (!files || files.length === 0) {
                reply.status(404).send()
                return
            }

            const fetchStart = Date.now()
            const pageItems = []
            for (const file of files.filter(f => !f.name.endsWith("/"))) {
                if (file.name.endsWith("-")) {
                    const fileName = file.name.replace(galleryPaths[subGallery], "").replace(/-$/, "")
                    pageItems.push({
                        type: "directory",
                        fileName: fileName
                    })
                } else {
                    const rawFile = await gcs.fetchObject(file)
                    let [metadata] = await file.getMetadata()
                    if (!metadata.metadata) {
                        metadata.metadata = {}
                    }

                    const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
                    pageItems.push({
                        type: "file",
                        contents: rawFile,
                        fileName: fileName,
                        alt: metadata.metadata["alt"] || "No alt text found",
                        title: metadata.metadata["title"] || fileName
                    })
                }
            }
            console.log(`Fetch time: ${Date.now() - fetchStart}ms`)
            const body = {
                page: pageItems,
                nextPage: nextPage
            }

            reply.status(200).send(body)
        })
        .catch(err => {
            console.log(`Error getting page for '${subGallery}' page: '${pageToken}'`)
            console.log(err)
            reply.status(500).send({error: "Internal server error"})
        })
})

fastify.get("/health", (request, reply) => reply.status(200).send())

fastify.listen({port: config.port}, function (err, address) {
    if (err) {
        fastify.log.error(err);
        console.log(err)
        process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
});