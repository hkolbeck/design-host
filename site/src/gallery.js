async function loadInitialPage(url) {
  const gallery = url.searchParams.get("gallery");
  if (!gallery) {
    console.log(`No gallery in URL: ${url.toString()}`);
    window.location.href = "https://acab.city/error";
    return;
  }

  const page = await fetchPage(gallery);
  if (!page) {
    console.log("Page fetch failed");
    window.location.href = "https://acab.city/error";
    return;
  }

  await renderPage(gallery, page.page, null, page.nextPage).catch((err) => {console.log(err)});
}

async function nextPage() {
  clearPage();
}

async function previousPage() {
  clearPage();
}

async function fetchPage(gallery, pageToken) {
  let url = `https://acab.city/api/get-page?gallery=${gallery}`;
  if (pageToken) {
    url += `&page=${pageToken}`;
  }

  return await fetch(url)
    .then(async (resp) => {
      if (resp.ok) {
        return await resp.json();
      } else {
        console.log(
          `Failed to fetch '${url}': ${resp.status} ${
            resp.statusText
          }: ${await resp.text()}`
        );
        return null;
      }
    })
    .catch((err) => {
      console.log(`Error fetching '${url}'`);
      console.log(err);
      return null;
    });
}

function clearPage() {
  for (let i = 0; i < 10; i++) {
    const img = document.getElementById(`gallery-image-${i}`);
    const title = document.getElementById(`gallery-title-${i}`);
    const dl = document.getElementById(`download-${i}`);
    img.style.display = "hidden";
    title.style.display = "hidden";
    dl.style.display = "hidden";
  }
}

async function pdfToPreviewDataUrl(pdfDataUrl) {
  const pdfData = pdfDataUrl.slice(pdfDataUrl.indexOf(",") + 1);
  const pdfBinaryData = Base64Binary.decode(pdfData)
  const loadingTask = pdfjsLib.getDocument(pdfBinaryData);
  const pdf = await loadingTask.promise.catch(err => {
    console.log(err)
    return null
  });
  // Fetch the first page.
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  // Support HiDPI-screens.
  const outputScale = window.devicePixelRatio || 1;

  // Prepare canvas using PDF page dimensions.
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);

  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

  // Render PDF page into canvas context.
  const renderContext = {
    canvasContext: context,
    transform,
    viewport,
  };
  await page.render(renderContext).promise;

  return canvas.toDataURL();
}

async function getPreviewDataUrl(contentDataUrl) {
  const preamble = contentDataUrl.slice(0, contentDataUrl.indexOf(","));
  if (preamble.match("image/jpeg") || preamble.match("image/png")) {
    return contentDataUrl;
  } else if (preamble.match("application/pdf")) {
    return await pdfToPreviewDataUrl(contentDataUrl);
  } else {
    console.log(`Unknown mime type in preamble: '${preamble}'`);
    return contentDataUrl;
  }
}

async function renderPage(gallery, files, currentToken, nextToken) {
  for (let i = 0; i < 10; i++) {
    const img = document.getElementById(`gallery-image-${i}`);
    const title = document.getElementById(`gallery-title-${i}`);
    const download = document.getElementById(`download-${i}`);

    if (files[i]) {
      let previewDataUrl = await getPreviewDataUrl(files[i].contents);
      console.log(`Data URL: ${previewDataUrl.length} chars: ${previewDataUrl.slice(0,100)}...`)
      img.onclick = () => {
        let div = document.createElement("div");
        div.className = "big-image-backer";

        let bigImg = document.createElement("img");
        bigImg.src = previewDataUrl;
        bigImg.alt = files[i].alt;
        bigImg.className = "big-image";
        div.appendChild(bigImg);

        div.onclick = () => {
          document.removeChild(div);
        };

        document.appendChild(div);
      };

      img.setAttribute("src", previewDataUrl);
      img.setAttribute("alt", files[i].alt);
      title.innerText = files[i].title;

      download.setAttribute("href", files[i].contents);
      download.setAttribute("download", files[i].fileName);

      img.style.display = "block";
      title.style.display = "block";
      download.style.display = "block";
    } else {
      img.style.display = "hidden";
      title.style.display = "hidden";
      download.style.display = "hidden";
    }
  }

  const prev = document.getElementById("previous-button");
  if (currentToken) {
    prev.href = `https://acab.city/gallery?gallery=${gallery}&page=${currentToken}`;
  } else {
    prev.style.display = "hidden";
  }

  const next = document.getElementById("next-button");
  if (nextToken) {
    next.href = `https://acab.city/gallery?gallery=${gallery}&page=${nextToken}`;
  } else {
    next.style.display = "hidden";
  }
}
