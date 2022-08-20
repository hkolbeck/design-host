const {Storage} = require('@google-cloud/storage');
const fastify = require("fastify")({
    logger: false,
});

const {makeGcsClient} = require("./src/gcs");

const config = {
    bucket: process.env.BUCKET,
    port: process.env.PORT
}

const storage = new Storage();
const gcs = makeGcsClient(storage, config.bucket)

const index =
const style =

const indexOpts = {
    handler: (request, reply) => {
    },
};
fastify.get("/", indexOpts);


fastify.listen({port: config.port}, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
    fastify.log.info(`server listening on ${address}`);
});