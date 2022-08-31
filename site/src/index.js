const displayTags = {
    "acab": "ACAB",
    "america": "America",
    "andy ngo": "Andy Ngo",
    "black": "Black",
    "blm": "BLM",
    "deaf": "Deaf",
    "gnwp": "GNWP",
    "indigenous": "Indigenous",
    "jewish": "Jewish",
    "karl marx": "Karl Marx",
    "oregon": "Oregon",
    "portland": "Portland",
    "rip": "RIP",
    "seeger": "Pete Seeger",
    "stafford beer": "Stafford Beer",
    "swerf": "SWERF",
    "terf": "TERF",
    "timbers": "Timbers",
    "thorns": "Thorns"
}

async function loadTags() {
    const tags = await apiFetch("https://acab.city/api/tag-groups", [])

    const tagContainer = document.getElementById("tags")
    tags.forEach(tag => {
        const displayTag = (displayTags[tag] || tag).replace(' ', '&nbsp;')
        const wrapper = document.createElement("span")
        wrapper.className = 'tag-wrapper'

        const link = document.createElement('a')
        link.href = `https://acab.city/tag/${tag}`
        link.innerHTML = displayTag
        wrapper.appendChild(link)

        tagContainer.appendChild(wrapper)
    })

    tagContainer.style.display = "block"
}

window.onload = loadTags
