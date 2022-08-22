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

    "/style/common.css": "style/common.css",
    "/style/gallery.css": "style/gallery.css",
    "/style/index.css": "style/index.css",

    "/images/acab-dot-city.png": "img/acab-dot-city.png",
    "/images/acab-dot-city.svg": "img/acab-dot-city.svg",
    "/images/download.svg": "img/download.svg",
    "/images/email.svg": "img/email.svg",
    "/images/instagram.svg": "img/instagram.svg",
    "/images/next-page.svg": "img/next-page.svg",
    "/images/prev-page.svg": "img/prev-page.svg",
    "/images/twitter.svg": "img/twitter.svg",

    "/src/gallery.js": "src/gallery.js"
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
    const pageSize = request.query['count'] || 10
    if (!galleryPaths[subGallery]) {
        console.log(`No path found for '${subGallery}'`)
        reply.status(400).send({error: `Unknown gallery: '${subGallery}'`})
        return
    }

    gcs.listDirectory(galleryPaths[subGallery], pageSize, pageToken)
        .then(async listResp => {
            if (!listResp) {
                reply.status(400).send({error: "Couldn't parse provided page token"})
                return
            }

            const {files, nextPage} = listResp
            if (!files || files.length === 0) {
                console.log(`No files found: ${JSON.stringify(files)}`)
                reply.status(404).send()
                return
            }

            const pageItems = []
            for (const file of files) {
                const rawFile = await gcs.fetchObject(file)
                const metadata = await file.getMetadata()
                const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
                pageItems.push({
                    contents: rawFile,
                    fileName: fileName,
                    alt: metadata.metadata["alt"] || "No alt text found",
                    title: metadata.metadata["title"] || fileName
                })
            }

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

fastify.listen({port: config.port}, function (err, address) {
    if (err) {
        fastify.log.error(err);
        console.log(err)
        process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
});