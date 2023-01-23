
function makeClient(bucket) {
    return {
        listDirectory: makeListDirectory(bucket),
        fetchObject: makeFetchObject(),
        fetchObjectRaw: makeFetchObjectRaw(bucket),
        fetchPath: makeFetchPath(bucket),
        getMetadata: makeGetMetadata(bucket),
        buildCollection: makeBuildCollection(bucket),
        fetchBatch: makeFetchBatch(bucket),
        listObjects: makeListObjects(bucket)
    }
}

function makeGetMetadata(bucket) {
    return async function getMetaData(path) {
        const file = bucket.file(path);
        const [metadata] = await file.getMetadata()
            .catch(err => {
                console.log(`Metadata fetch failed for '${path}': ${err.message}`)
                return [null]
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
            tags: metadata.metadata["tags"] || "",
            blur: metadata.metadata["blur"] || false,
            notOurs: metadata.metadata["notours"] || false,
            mtime: Date.parse(metadata.timeCreated) || 0
        }
    }
}

async function listDirBatch(bucket, pageQuery, maxResults) {
    pageQuery.maxResults = maxResults
    let [files, nextPage] = await bucket.getFiles(pageQuery)
    if (files.length < maxResults && nextPage) {
        while (files.length < maxResults && nextPage) {
            nextPage.maxResults = 1 //lolsob
            const [batchFiles, batchNextPage] = await bucket.getFiles(nextPage)
            if (!batchFiles || batchFiles.length === 0) {
                break;
            }

            files.push(...batchFiles)
            nextPage = batchNextPage
        }
    }

    return {
        files: files,
        nextPage: nextPage ? Buffer.from(JSON.stringify(nextPage)).toString("base64url") : null
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

            return await listDirBatch(bucket, pageQuery, 10)
        } else {
            return await listDirBatch(bucket, {
                prefix: prefix,
                autoPaginate: false,
                delimiter: '/'
            }, 11)
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
                blur: metadata.metadata["blur"] === "true",
                notOurs: metadata.metadata["notours"] === "true",
                author: metadata.metadata["author"] || null
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
            console.log(`Path: '${path}' - ${!!file}`)
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

let UNSEARCHABLE = {
    "a": true,
    "an": true,
    "and": true,
    "at": true,
    "be": true,
    "of": true,
    "the": true,
    "this": true,
    "to": true
}

function makeBuildCollection(bucket) {
    return async function buildCollection() {
        const tagGroups = {}
        const collection = {}
        const [files] = await bucket.getFiles()

        for (let file of files.filter(f => !f.name.endsWith("/"))) {
            const type = file.name.endsWith("-") ? "directory" : "file"
            const actualPath = file.name.replace("0000", "").replace(/-$/, "")

            const [metadata] = await file.getMetadata() || []
            if (metadata && metadata.metadata) {
                if (metadata.metadata["tags"]) {
                    metadata.metadata["tags"].split(",")
                        .map(tag => tag.trim().toLowerCase())
                        .filter(t => !!t)
                        .forEach(tag => {
                            if (!collection[tag]) {
                                collection[tag] = []
                            }
                            collection[tag].push({type, path: actualPath})

                            tagGroups[tag] = tagGroups[tag] || []
                            tagGroups[tag].push({type, path: actualPath})
                        })
                } else {
                    tagGroups["untagged"] = tagGroups["untagged"] || []
                    tagGroups["untagged"].push({type, path: actualPath})
                }

                let title = metadata.metadata["title"] || ""
                title.split(/\s+/g)
                    .filter(w => !!w)
                    .map(w => w.toLowerCase())
                    .filter(w => !UNSEARCHABLE[w])
                    .forEach(word => {
                        if (!collection[word]) {
                            collection[word] = []
                        }

                        collection[word].push({type, path: actualPath})
                    })

                let alt = metadata.metadata["alt"] || ""
                alt.split(/\s+/g)
                    .filter(w => !!w)
                    .map(w => w.toLowerCase())
                    .filter(w => !UNSEARCHABLE[w])
                    .forEach(word => {
                        if (!collection[word]) {
                            collection[word] = []
                        }

                        collection[word].push({type, path: actualPath})
                    })

                let author = metadata.metadata["author"];
                if (author) {
                    author = author.toLowerCase()
                    if (!collection[author]) {
                        collection[author] = []
                    }

                    collection[author].push({type, path: actualPath})
                }
            } else {
                tagGroups["untagged"] = tagGroups["untagged"] || []
                tagGroups["untagged"].push({type, path: actualPath})
            }
        }

        return {tagGroups, collection}
    }
}

function makeFetchBatch(bucket) {
    const fetchPath = makeFetchPath(bucket)
    return async function fetchBatch(items) {
        const batch = await Promise.all(items.map(async item => {
            if (item.type === "directory") {
                return {
                    type: "directory",
                    fullPath: item.path,
                    fileName: item.path.slice(item.path.lastIndexOf("/") + 1)
                }
            } else {
                return await fetchPath(item.path)
            }
        }))

        return batch.filter(o => !!o)
    }
}

function makeListObjects(bucket) {
    return async function listObjects() {
        const paths = []
        const [files] = await bucket.getFiles()
        for (let file of files) {
            if (!file.name.endsWith('-') && !file.name.endsWith('/')) {
                paths.push(file.name)
            }
        }

        return paths
    }
}


exports.makeGcsClient = makeClient;
