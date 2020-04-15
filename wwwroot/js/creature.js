import Mustache from './mustache.js';
import { delegate } from './tippy.esm.js';
import './event-delegation.js';

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
        const container = (function (map, creatureData, fragment) {
            const container = document.createElement('div');
            container.id = 'container';
            container.innerHTML = document.querySelector('template[name=Container]').innerHTML;

            container.querySelector('.outline').innerHTML = Mustache.render(document.querySelector('template[name=Outline]').innerHTML, creatureData.Outline);
            const content = container.querySelector('.content');
            
            delegate(content, {
                target: '.tooltip',
                content: 'Loading...',
                arrow: false,
                allowHTML: true,
                theme: 'custom',
                onShow: instance => {
                    const element = instance.reference;
                    const html = Mustache.render(document.querySelector(`template[name=${element.dataset.template}]`).innerHTML, map.get(activeTab.getAttribute('name'))[element.getAttribute('name')]);
                    instance.setContent(html);
                },
                onHidden: instance => {
                    instance.setContent('Loading...');
                }
            });

            const tab = container.querySelector('.tab');
            tab.addEventListener('click', e => {
                const button = e.target.closest('.tab-button');
                if (!button)
                    return;

                activeTab.classList.remove('active-tab');
                activateTab(button);
            });

            const tabs = new Map();
            tab.querySelectorAll('.tab-button')
                .forEach(v => tabs.set(v.getAttribute('name'), v));
            let activeTab = undefined;
            activateTab(tabs.get(fragment));

            return container;

            function activateTab(button) {
                const name = button.getAttribute('name');
                button.classList.add('active-tab');
                activeTab = button;
                const tabContent = GetContent();
                tabContent.renderContent();
                tabContent.setupEventListeners();

                function GetContent() {
                    switch (name) {
                        case 'Properties':
                            return new Properties(content, creatureData.Detail, map.get(name));
                        case 'Skills':
                            return new Skills(content, creatureData.Detail, map.get(name));
                        default:
                            return new TabContent(content, name, creatureData.Detail);
                    }
                }
            }
        })(map, creatureData, fragment);
        document.body.appendChild(container);
    }
})();

class TabContent {
    constructor(content, name, data) {
        this.content = content;
        this.name = name;
        this.data = data;
    }

    get template() {
        return document.querySelector(`template[name=${this.name}]`).innerHTML;
    }

    renderContent() {
        this.content.innerHTML = Mustache.render(this.template, this.data);
    }

    setupEventListeners() {
    }
}

class TabContentWithFilter extends TabContent {
    constructor(content, name, data) {
        super(content, name, data);
    }

    get templateNameBody() {
        return '';
    }

    setupEventListeners() {
        this.content.on('change', 'div.filter > .all label.checkbox > input[type=checkbox]', e => {
            if (this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked').length === 0)
                e.target.checked = true;
            else
                e.target.checked = false;
            e.target.indeterminate = false;

            this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]').forEach(v => v.checked = e.target.checked);

            this.filterChanged();
        });

        this.content.on('change', 'div.filter > .specific label.checkbox', e => {
            const checkedCount = this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked').length;
            const checkboxAll = this.content.querySelector('div.filter > .all label.checkbox > input[type=checkbox]');
            if (checkedCount === 0)
                checkboxAll.indeterminate = checkboxAll.checked = false;
            else if (checkedCount < this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]').length)
                checkboxAll.indeterminate = true;
            else {
                checkboxAll.checked = true;
                checkboxAll.indeterminate = false;
            }

            this.filterChanged();
        });
    }

    renderContent() {
        super.renderContent();
        this.renderFilter();
        this.renderBody();
    }

    renderFilter() {
        this.content.querySelector('div.tabular-section.filter').innerHTML = Mustache.render(document.querySelector('template[name=ContentFilter]').innerHTML, this.data);
        this.content.querySelectorAll('div.tabular-section.filter label.checkbox > input[type=checkbox]').forEach(v => v.checked = true);
    }

    renderBody() {
        this.content.querySelector('div.tabular-section.associative-array').innerHTML = Mustache.render(document.querySelector(`template[name=${this.templateNameBody}]`).innerHTML, this.data);
    }

    filterChanged() {
    }
}

class Properties extends TabContentWithFilter {
    constructor(content, creatureDetail, properties) {
        const tags = new Set();
        creatureDetail.Properties.forEach(x => {
            properties[x.ID].Tags.forEach(y => {
                if (!tags.has(y))
                    tags.add(y);
            });
        });
        super(content, 'Properties', { Filter: [...tags], Properties: creatureDetail.Properties.slice() });
        this.properties = properties;
        this.tags = tags;
        this.creatureProperties = creatureDetail.Properties;
    }

    get templateNameBody() {
        return 'PropertiesBody';
    }

    filterChanged() {
        const tags = new Set();
        this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked').forEach(v => {
            const id = v.closest('label.checkbox').getAttribute('name');
            if (!tags.has(id))
                tags.add(id);
        });
        this.data.Properties = this.creatureProperties.filter(x => this.properties[x.ID].Tags.some(y => tags.has(y)));
        this.renderBody();
    }
}

class Skills extends TabContentWithFilter {
    constructor(content, creatureDetail, skills) {
        const tags = new Set();
        creatureDetail.Skills.forEach(x => {
            skills[x.ID].Tags.forEach(y => {
                if (!tags.has(y))
                    tags.add(y);
            });
        });
        super(content, 'Skills', { Filter: [...tags], Skills: creatureDetail.Skills.slice() });
        this.skills = skills;
        this.tags = tags;
        this.creatureSkills = creatureDetail.Skills;
    }

    get templateNameBody() {
        return 'SkillsBody';
    }

    filterChanged() {
        const tags = new Set();
        this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked').forEach(v => {
            const id = v.closest('label.checkbox').getAttribute('name');
            if (!tags.has(id))
                tags.add(id);
        });
        this.data.Skills = this.creatureSkills.filter(x => this.skills[x.ID].Tags.some(y => tags.has(y)));
        this.renderBody();
    }
}
