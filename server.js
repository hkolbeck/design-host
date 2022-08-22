const {Storage} = require('@google-cloud/storage');
const fastify = require("fastify")({
    logger: false,
});

const {makeGcsClient} = require("./src/gcs");

const config = {
    bucket: process.env.BUCKET,
    port: process.env.PORT,
    pageSize: process.env.PAGE_SIZE
}

const storage = new Storage();
const gcs = makeGcsClient(storage, config.bucket)

const galleryPaths = {
    stickers: '/stickers/',
    jewelry: '/jewelry/',
    stencils: '/stencils/',
    flyers: '/flyers/',
    signage: '/signage/'
}

fastify.get("/", (request, reply) => {

});

fastify.get("/api/get-page", (request, reply) => {
    const pageToken = request.query['page']
    const subGallery = request.query['gallery']
    if (!galleryPaths[subGallery]) {
        reply.status(400).send({error: `Unknown gallery: '${subGallery}'`})
        return
    }

    gcs.listDirectory(galleryPaths[subGallery], config.pageSize + 1, pageToken)
        .then(async listResp => {
            if (!listResp) {
                reply.status(400).send({error: "Couldn't parse provided page token"})
                return
            }

            const {files, nextPage} = listResp
            if (!files || files.length === 0) {
                reply.status(404).send()
                return
            }

            const pageItems = []
            for (const file of files) {
                const rawFile = await gcs.fetchObject(file)
                const metadata = await file.getMetadata()
                pageItems.push({
                    contents: rawFile,
                    path: file.name,
                    alt: metadata.metadata["alt"] || "No alt text found",
                    title: metadata.metadata["title"] ||
                        file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
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
        process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
});