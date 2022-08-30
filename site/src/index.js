async function loadTags() {
    const tags = apiFetch("https://acab.city/api/tag-groups", [])

    const tagContainer = document.getElementById("tags")
    tags.forEach(tag => {
        const wrapper = document.createElement("span")
        wrapper.className = 'tag-wrapper'

        const link = document.createElement('a')
        link.href = `https://acab.city/tag/${tag}`
        wrapper.appendChild(link)

        tagContainer.appendChild(wrapper)
    })

    tagContainer.style.display = "block"
}

window.onload = loadTags
