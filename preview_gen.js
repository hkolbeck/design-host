const path = require('path')
const fs = require('fs')

const {Storage} = require('@google-cloud/storage');

const {makeGcsClient} = require('./src/gcs');
const {generateOpengraphImage, generateBrowseImage} = require('./src/images');

const config = {
    bucket: process.env.BUCKET
}

const storage = new Storage();
const gcs = makeGcsClient(storage.bucket(config.bucket))

let supported = {
    "jpg": true,
    "jpeg": true,
    "png": true,
    "svg": true,
    "pdf": true,
    "txt": true
}

let running = false
async function generatePreviews() {
    let start = Date.now()
    if (running) {
        return
    }
    running = true


    let gcsPaths = await gcs.listObjects()
    console.log(`Found ${gcsPaths.length} objects to check`)

    for (let gcsPath of gcsPaths) {
        let ext = gcsPath.slice(gcsPath.lastIndexOf('.') + 1)
        if (!supported[ext]) {
            console.log(`Skipping '${gcsPath}'`)
            continue
        }

        let gcsMetadata = await gcs.getMetadata(gcsPath)
        await generatePreview(gcs, gcsPath, gcsMetadata.mtime, "browse", generateBrowseImage)
        await generatePreview(gcs, gcsPath, gcsMetadata.mtime, "opengraph", generateOpengraphImage)
    }

    running = false
    console.log(`Run finished in ${Date.now() - start}ms`)
}

async function generatePreview(gcs, gcsPath, gcsMTime, localDir, imgFn) {
    let fsPath = path.join('site', 'img', localDir, gcsPath) + '.png'

    let fileMTime
    try {
        let stats = fs.lstatSync(fsPath);
        fileMTime = stats.mtimeMs;
    } catch (_) {
        fileMTime = 0
    }

    if (gcsMTime > fileMTime) {
        let start = Date.now();
        let dir = path.dirname(fsPath);
        fs.mkdirSync(dir, {recursive: true})

        try {
            let contents = await imgFn(gcs, gcsPath, false)
            fs.writeFileSync(fsPath, contents)
            console.log(`Wrote '${fsPath}' for '${gcsPath}' in ${Date.now() - start}ms`)
        } catch (err) {
            console.log(`Failed to generate and write opengraph img for '${gcsPath}'`)
            console.log(err)
        }
    }
}

function task() {
    generatePreviews().catch(err => {
        console.log("Error generating previews")
        console.log(err)
    })
}

task()
setInterval(task, 5 * 60 * 1000)