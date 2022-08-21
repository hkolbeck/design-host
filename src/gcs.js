function makeClient(gcs, bucket) {
    return {
        listDirectory: makeListDirectory(gcs, bucket),
        fetchObject: makeFetchObject(gcs, bucket),
        fetchObjects: makeFetchObjects(gcs, bucket),
    }
}

function makeListDirectory(gcs, bucket) {
    return async function listDirectory(prefix) {
        const files = await gcs.bucket(bucket).getFiles({prefix: prefix})
        return files.map(f => f.name)
    }
}

function makeFetchObject(gcs, bucket) {
    return async function fetchObject(path) {
        return new Promise((resolve, reject) => {
            gcs.bucket(bucket).file(path).download((err, contents) => {
                if (contents) {
                    resolve(contents)
                } else if (err) {
                    reject(err)
                } else {
                    reject(new Error("Both contents and err were null"))
                }
            })
        })
    }
}

function makeFetchObjects(gcs, bucket) {
    return async function fetchObjects(prefix) {
        const files = await gcs.bucket(bucket).getFiles({prefix: prefix})
        return await Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    gcs.bucket(bucket).file(file.name).download((err, contents) => {
                        if (contents) {
                            resolve(contents)
                        } else if (err) {
                            reject(err)
                        } else {
                            reject(new Error("Both contents and err were null"))
                        }
                    })
                })
            })
        )
    }
}

exports.makeGcsClient = makeClient;