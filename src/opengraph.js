// import {createCanvas} from "canvas";

async function generateOpengraph(gcs, gcsPath) {
    const metadata = await gcs.getMetadata(gcsPath)

    return `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>ACAB.city</title>
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico"/>
    <meta name="description" content="The LaserBloc Design Gallery"/>
    <meta name="twitter:title" content="${metadata.title}">
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@LaserBloc" />
    <meta name="twitter:creator" content="@LaserBloc" />
    <meta name="twitter:image:alt" content="${metadata.alt}">
    <meta property="og:url" content="https://acab.city/gallery/${gcsPath}" />
    <meta property="og:title" content="${metadata.title}" />
    <meta property="og:description" content="${metadata.alt}" />
    <meta property="og:image" content="http://acab.city/api/preview/${gcsPath}" />
    <meta property="og:image:alt" content="${metadata.alt}" />
</head>
<body>
</body>
</html>`
}

async function generatePreviewImage(gcs, gcsPath) {
    const {mime, contents} = await gcs.fetchObjectRaw(gcsPath)
        .catch(err => {
            console.log(`Failed to get '${gcsPath}' raw: ${err.message}`)
            return {}
        })

    if (!contents) {
        return {}
    }

    if (mime === "image/png" || mime === "image/jpg" || mime === "image/jpeg") {
        return {mime, contents}
    }

    throw new Error(`Unsupported mime type: ${mime}`)
}

exports.generateOpengraph = generateOpengraph;
exports.generatePreviewImage = generatePreviewImage;