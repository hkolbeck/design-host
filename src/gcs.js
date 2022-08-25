function makeClient(bucket) {
    return {
        listDirectory: makeListDirectory(bucket),
        fetchObject: makeFetchObject(bucket),
        fetchObjects: makeFetchObjects(bucket),
        fetchPath: makeFetchPath(bucket)
    }
}

function makeListDirectory(bucket) {
    return async function listDirectory(prefix, pageToken) {
        if (pageToken) {
            const pageQuery = JSON.parse(Buffer.from(pageToken, "base64url").toString("utf8"))
            if (!pageQuery) {
                console.log(`Couldn't parse page token as JSON: '${pageToken}'`)
                return null
            }

            pageQuery.maxResults = 10
            let [files, nextPage] = await bucket.getFiles(pageQuery)
            return {
                files: files,
                nextPage: nextPage ? Buffer.from(JSON.stringify(nextPage)).toString("base64url") : null
            }
        } else {
            let [files, nextPage] = await bucket.getFiles({
                prefix: prefix,
                autoPaginate: false,
                maxResults: 11,
                delimiter: '/'
            });

          return {
                files: files,
                nextPage: nextPage ? Buffer.from(JSON.stringify(nextPage)).toString("base64url") : null
            }
        }
    }
}

function makeFetchPath(bucket) {
    const fetchObject = makeFetchObject()
    return async function fetchPath(path) {
        let file = bucket.file(path);
        const contentsP = fetchObject(file);
        const metadataP = file.getMetadata()
        const [contents, metadataArr] = await Promise.all([contentsP, metadataP])
            .catch(err => {
                console.log(`Error fetching single for ${path}: ${err.message()}`)
                return [null, null]
            })

        let metadata
        if (metadataArr && metadataArr.length > 0) {
            metadata = metadataArr[0]
            if (!metadata.metadata) {
                metadata.metadata = {}
            }
        } else {
            metadata = {
                metadata: {}
            }
        }

        if (contents) {
            const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
            return {
                type: "file",
                contents: contents,
                fileName: fileName,
                fullPath: file.name,
                alt: metadata.metadata["alt"] || "No alt text found",
                title: metadata.metadata["title"] || fileName,
                blur: metadata.metadata["blur"] === "true"
            }
        } else {
            return null;
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
                    } else if (file.name.endsWith("txt")) {
                        mime = "text/plain"
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

function makeFetchObjects(bucket) {
    return async function fetchObjects(paths) {
        return await Promise.all(paths.map(file => {
                return new Promise((resolve, reject) => {
                    bucket.file(file.name).download((err, contents) => {
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