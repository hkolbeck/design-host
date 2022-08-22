function makeClient(gcs, bucket) {
    return {
        listDirectory: makeListDirectory(gcs, bucket),
        fetchObject: makeFetchObject(gcs, bucket),
        fetchObjects: makeFetchObjects(gcs, bucket),
    }
}

function makeListDirectory(gcs, bucket) {
    return async function listDirectory(prefix, limit, pageToken) {
        console.log(`Got list for prefix: '${prefix}' limit: '${limit}' page: ${pageToken}`)
        if (pageToken) {
            const pageQuery = JSON.parse(Buffer.from(pageToken, "base64url").toString("utf8"))
            if (!pageQuery) {
                console.log(`Couldn't parse page token as JSON: '${pageToken}'`)
                return null
            }

            let [files, nextPage] = await gcs.bucket(bucket).getFiles(pageQuery)
            return {
                files: files,
                nextPage: nextPage ? Buffer.from(JSON.stringify(nextPage)).toString("base64url") : null
            }
        } else {
            let [files, nextPage] = await gcs.bucket(bucket).getFiles({
                prefix: prefix,
                autoPaginate: false,
                maxResults: limit,
                delimiter: '/'
            });
            return {
                files: files,
                nextPage: nextPage ? Buffer.from(JSON.stringify(nextPage)).toString("base64url") : null
            }
        }
    }
}

function makeFetchObject() {
    return async function fetchObject(file) {
        return new Promise((resolve, reject) => {
            file.download((err, contents) => {
                if (contents) {
                    let mime
                    if (file.name.endsWith("pdf")) {
                        mime = "application/pdf"
                    } else if (file.name.endsWith("png")) {
                        mime = "image/png"
                    } else if (file.name.endsWith("jpeg") || file.name.endsWith("jpg")) {
                        mime = "image/jpeg"
                    } else {
                        reject(new Error(`Unknown mime type for file '${file.name}'`))
                        return
                    }

                    resolve(`data:${mime};base64,${contents.toString("base64")}`)
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
    return async function fetchObjects(paths) {
        return await Promise.all(paths.map(file => {
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