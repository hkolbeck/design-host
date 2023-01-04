async function search() {
    const searchBar = document.getElementById("search-input");
    const rawSearch = searchBar.value;
    if (!rawSearch) {
        return
    }

    let sendEmTo = `https://acab.city/search?s=${encodeURIComponent(rawSearch)}`;

    const searchType = document.getElementById("type-filter");
    let selected = [];
    for (let option of searchType.options) {
        if (option.selected) {
            selected.push(option.value)
        }
    }

    selected = selected.filter(o => o !== 'any')
    if (selected.length > 0) {
        sendEmTo = sendEmTo + `&types=${encodeURIComponent(selected.join(','))}`
    }

    window.location.href = sendEmTo;
}

function deselectAny() {
    const anyOption = document.getElementById("any-option")
    anyOption.selected = false
}

function deselectOthers() {
    const searchType = document.getElementById("type-filter");
    for (let option of searchType.options) {
        if (option.value !== 'any') {
            option.selected = false
        }
    }
}

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
    "ted wheeler": "Ted Wheeler",
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

window.onload = () => {
    document.getElementById("search-input").addEventListener("keyup", event => {
        event.preventDefault();
        if (event.keyCode === 13) {
            search().catch(err => {
                console.log("Error in search:")
                console.log(err)
            })
        }
    })
    loadTags().catch(err => {
        console.log("Error in load tags:")
        console.log(err)
    })
}
