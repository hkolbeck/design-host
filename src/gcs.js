function makeClient(bucket) {
    return {
        listDirectory: makeListDirectory(bucket),
        fetchObject: makeFetchObject(),
        fetchObjectRaw: makeFetchObjectRaw(bucket),
        fetchPath: makeFetchPath(bucket),
        getMetadata: makeGetMetadata(bucket)
    }
}

function makeGetMetadata(bucket) {
    return async function getMetaData(path) {
        const file = bucket.file(path);
        const [metadata] = await file.getMetadata()
            .catch(err => {
                console.log(`Metadata fetch failed for '${path}': ${err.message}`)
                return null
            })

        if (!metadata) {
            return null
        }

        if (!metadata.metadata) {
            metadata.metadata = {}
        }

        const fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf("."))
        return {
            alt: metadata.metadata["alt"] || "No alt text found",
            title: metadata.metadata["title"] || fileName,
        }
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
        const file = bucket.file(path);
        const contentsP = fetchObject(file);
        const metadataP = file.getMetadata()
        const [contents, metadataArr] = await Promise.all([contentsP, metadataP])
            .catch(err => {
                console.log(`Error fetching single for ${path}: ${err.message}`)
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

function filenameToMimeType(filename) {
    if (filename.endsWith("pdf")) {
        return "application/pdf"
    } else if (filename.endsWith("png")) {
        return "image/png"
    } else if (filename.endsWith("jpeg") || filename.endsWith("jpg")) {
        return "image/jpeg"
    } else if (filename.endsWith("txt")) {
        return "text/plain"
    } else if (filename.endsWith("svg")) {
        return "image/svg+xml"
    } else {
        return null
    }
}

function makeFetchObject() {
    return async function fetchObject(file) {
        return new Promise((resolve, reject) => {
            file.download((err, contents) => {
                if (contents) {
                    const mime = filenameToMimeType(file.name)
                    if (!mime) {
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

function makeFetchObjectRaw(bucket) {
    return async function fetchObjectRaw(path) {
        return new Promise((resolve, reject) => {
            const file = bucket.file(path)
            file.download((err, contents) => {
                if (contents) {
                    const mime = filenameToMimeType(file.name)
                    if (!mime) {
                        reject(new Error(`Unknown mime type for file '${file.name}'`))
                        return
                    }
                    resolve({mime, contents})
                } else if (err) {
                    reject(err)
                } else {
                    reject(new Error("Both contents and err were null"))
                }
            })
        })
    }
}

exports.makeGcsClient = makeClient;