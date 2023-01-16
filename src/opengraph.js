const NodeCache = require("node-cache");
const {OG_PREVIEW_HEIGHT, OG_PREVIEW_WIDTH} = require("./images")

const metadataCache = new NodeCache({stdTTL: 5 * 60, useClones: false});

async function generateOpengraphHtml(gcs, path, ext) {
    let gcsPath = `${path}.${ext}`

    let metadata;
    if (metadataCache.has(gcsPath)) {
        metadata = metadataCache.get(gcsPath);
    } else {
        metadata = await gcs.getMetadata(gcsPath);
        metadataCache.set(gcsPath, metadata);
    }

    let encodedPath = encodeURIComponent(path).replace(/%2f/ig, "/")
    let encodedGcsPath = encodeURIComponent(gcsPath).replace(/%2f/ig, "/")
    let alt = encodeQuotes(metadata.alt);
    let title = encodeQuotes(metadata.title);

    console.log(`Generating OpenGraph for '${encodedGcsPath}'`)
    return `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>ACAB.city</title>
    <link rel="icon" type="image/png" href="/img/favicon.png"/>
    <meta name="description" content="The LaserBloc Design Gallery"/>
    
    <meta name="twitter:title" content="${title}"/>
    <meta name="twitter:text:title" content="${title}"/>
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@LaserBloc" />
    <meta name="twitter:creator" content="@LaserBloc" />
    <meta name="twitter:image" content="https://acab.city/preview/${encodedGcsPath}.png">
    <meta name="twitter:image:alt" content="${alt}">
    <meta name="twitter:image:width" content="${OG_PREVIEW_WIDTH}" />
    <meta name="twitter:image:height" content="${OG_PREVIEW_HEIGHT}" />   
    <meta property="og:title" content="${title}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://acab.city/gallery/${encodedPath}?ext=${ext}" />
    <meta property="og:description" content="${alt}" />
    <meta property="og:image" content="https://acab.city/preview/${encodedGcsPath}.png" />
    <meta property="og:image:width" content="${OG_PREVIEW_WIDTH}" />
    <meta property="og:image:height" content="${OG_PREVIEW_HEIGHT}" />    
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${alt}" />
    <meta property="og:site_name" content="ACAB.city">
    <meta property="og:locale" content="en">
</head>
<body>
</body>
</html>`
}

function encodeQuotes(str) {
    return str.replaceAll('"', "&quot;")
}

exports.generateOpengraphHtml = generateOpengraphHtml;
