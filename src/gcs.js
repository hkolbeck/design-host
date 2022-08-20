
function makeClient(gcs, bucket) {
    return {
        listDirectory: makeListDirectory(gcs, bucket),
        fetchObject: makeFetchObject(gcs, bucket),
        fetchObjects: makeFetchObjects(gcs, bucket),
        uploadObject: makeUploadObject(gcs, bucket)
    }
}

async function makeListDirectory(gcs, bucket) {

}

async function makeFetchObject(gcs, bucket) {

}

async function makeFetchObjects(gcs, bucket) {

}

async function makeUploadObject(gcs, bucket) {

}

exports.makeGcsClient = makeClient;