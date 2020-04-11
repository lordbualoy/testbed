import Mustache from './mustache.js';
import tippy from './tippy.esm.js';

(async function () {
    const queryString = new URLSearchParams(window.location.search);
    const fragment = window.location.hash === "" ? "Profile" : window.location.hash.substring(1);
    const creatureID = queryString.get('creature');
    if (creatureID) {
        const data = await Promise.all([
            fetch('wwwroot/json/attributes.json').then((resp) => resp.json())
            , fetch('wwwroot/json/properties.json').then((resp) => resp.json())
            , fetch('wwwroot/json/skills.json').then((resp) => resp.json())
            , fetch('wwwroot/json/traits.json').then((resp) => resp.json())
            , fetch(`wwwroot/json/creatures/${creatureID}.json`).then((resp) => resp.json())
        ]);

        const map = new Map();
        map.set('Attributes', data[0]);
        map.set('Properties', data[1]);
        map.set('Skills', data[2]);
        map.set('Traits', data[3]);
        const creatureData = data[4];

        document.title = creatureData.Outline.NickName;
        const creature = new Creature(map, creatureData);
        document.body.appendChild(creature.container);
        creature.activeTab(fragment);
    }
})();

class Creature {
    constructor(map, creatureData) {
        this.map = map;
        this.creatureData = creatureData;

        this.container = document.createElement('div');
        this.container.id = 'container';
        this.container.innerHTML = document.querySelector('template[name=Container]').innerHTML;

        this.container.querySelector('.outline').innerHTML = Mustache.render(document.querySelector('template[name=Outline]').innerHTML, creatureData.Outline);

        this.tab = this.container.querySelector('.tab');
        this.content = this.container.querySelector('.content');

        this.tab.querySelectorAll('.tab-button').forEach(x => {
            x.addEventListener('click', e => this.activeTab(e.target.getAttribute('name')));
        });
    }

    activeTab(name) {
        this.tab.querySelectorAll('.tab-button').forEach(x => x.classList.remove('active-tab'));
        this.tab.querySelector(`.tab-button[name=${name}]`).classList.add('active-tab');
        this.content.innerHTML = Mustache.render(document.querySelector(`template[name=${name}]`).innerHTML, this.creatureData.Detail);

        tippy(document.querySelectorAll('.tooltip'), {
            content: 'Loading...',
            arrow: false,
            allowHTML: true,
            theme: 'custom',
            onShow: instance => {
                const element = instance.reference;
                const html = Mustache.render(document.querySelector(`template[name=${element.dataset.template}]`).innerHTML, this.map.get(name)[element.getAttribute('name')]);
                instance.setContent(html);
            },
            onHidden: instance => {
                instance.setContent('Loading...');
            }
        });
    }
}