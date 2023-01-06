const p = require('path')
const fs = require('fs')

const {Storage} = require('@google-cloud/storage');

const {makeGcsClient} = require('./src/gcs');
const {generatePreviewImage} = require('./src/opengraph');

const config = {
    bucket: process.env.BUCKET,
    fileRoot: process.env.PREVIEW_ROOT
}

const storage = new Storage();
const gcs = makeGcsClient(storage.bucket(config.bucket))

let running = false
async function generatePreviews() {
    if (running) {
        return
    }
    running = true

    let paths = await gcs.listObjects()
    console.log(`Found ${paths.length} objects to check`)

    for (let gcsPath of paths) {
        let fsPath = p.join('site', 'img', 'preview', gcsPath) + '.png'
        let fileMtime
        try {
            let stats = fs.lstatSync(fsPath);
            fileMtime = stats.mtimeMs;
        } catch (_) {
            fileMtime = 0
        }

        let gcsMetadata = await gcs.getMetadata(gcsPath)
        if (gcsMetadata.mtime > fileMtime) {
            let start = Date.now();
            let dir = p.dirname(fsPath);
            fs.mkdirSync(dir, {recursive: true})

            let contents = generatePreviewImage(gcs, gcsPath, false)
            fs.writeFileSync(fsPath, contents)
            console.log(`Wrote '${fsPath}' for '${gcsPath}' in ${Date.now() - start}ms`)
        }
    }

    running = false
}

function task() {
    generatePreviews().catch(err => {
        console.log("Error generating previews")
        console.log(err)
    })
}

task()
setInterval(task, 5 * 60 * 1000)