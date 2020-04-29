import Mustache from './mustache.js';
import { delegate } from './tippy.esm.js';
import './event-delegation.js';
import './date.js';
import './array.js';

const queryString = new URLSearchParams(window.location.search);
const fragment = window.location.hash === '' ? 'Profile' : window.location.hash.substring(1);
const creatureID = queryString.get('creature');
const date = (function () {
    const temp = queryString.get('date');
    return temp ? new Date(temp) : null;
})();

class Compendium {
    static async Initialize() {
        if (this.initialized)
            return;

        const data = await Promise.all([
            fetch('../wwwroot/json/races.json').then((resp) => resp.json())
            , fetch('../wwwroot/json/attributes.json').then((resp) => resp.json())
            , fetch('../wwwroot/json/properties.json').then((resp) => resp.json())
            , fetch('../wwwroot/json/skills.json').then((resp) => resp.json())
            , fetch('../wwwroot/json/traits.json').then((resp) => resp.json())
        ]);

        let i = 0;
        Compendium.Races = data[i++];
        Compendium.Attributes = data[i++];
        Compendium.Properties = data[i++];
        Compendium.Skills = data[i++];
        Compendium.Traits = data[i++];

        this.initialized = true;
    }
}

(async function () {
    if (creatureID) {
        const fetchCreatureData = fetch(`../wwwroot/json/creatures/${creatureID}.json`).then((resp) => resp.json());
        await Compendium.Initialize();
        const creatureData = Creature.BuildCurrentData(await fetchCreatureData);

        document.title = creatureData.Outline.NickName;
        const container = (function (creatureData, fragment) {
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
                    const html = Mustache.render(document.querySelector(`template[name=${element.dataset.template}]`).innerHTML, Compendium[activeTab.getAttribute('name')][element.getAttribute('name')]);
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
            for (const v of tab.querySelectorAll('.tab-button')) 
                tabs.set(v.getAttribute('name'), v);
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
                        case 'Profile':
                            return new Profile(content, creatureData.Detail);
                        case 'Properties':
                            return new Properties(content, creatureData.Detail);
                        case 'Skills':
                            return new Skills(content, creatureData.Detail);
                        default:
                            return new TabContent(content, name, creatureData.Detail);
                    }
                }
            }
        })(creatureData, fragment);
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

            for (const v of this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]'))
                v.checked = e.target.checked;

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
        for (const v of this.content.querySelectorAll('div.tabular-section.filter label.checkbox > input[type=checkbox]'))
            v.checked = true;
    }

    renderBody() {
        this.content.querySelector('div.tabular-section.associative-array').innerHTML = Mustache.render(document.querySelector(`template[name=${this.templateNameBody}]`).innerHTML, this.data);
    }

    filterChanged() {
    }
}

class Profile extends TabContent {
    constructor(content, creatureDetail) {
        super(content, 'Profile', creatureDetail);
    }

    renderContent() {
        this.content.innerHTML = this.template;
        const template = document.querySelector('template[name=ProfileBody]').innerHTML;
        for (const profile of this.data.Profile) {
            this.content.querySelector('#content-profile').insertAdjacentHTML('beforeend', Mustache.render(template, profile));
        }
    }
}

class Properties extends TabContentWithFilter {
    constructor(content, creatureDetail) {
        const tags = new Set();
        for (const x of creatureDetail.Properties) {
            for (const y of Compendium.Properties[x.ID].Tags) {
                if (!tags.has(y))
                    tags.add(y);
            }
        }
        super(content, 'Properties', { Filter: [...tags], Properties: creatureDetail.Properties.slice() });
        this.tags = tags;
        this.creatureProperties = creatureDetail.Properties;
    }

    get templateNameBody() {
        return 'PropertiesBody';
    }

    filterChanged() {
        const tags = new Set();
        for (const v of this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked')) {
            const id = v.closest('label.checkbox').getAttribute('name');
            if (!tags.has(id))
                tags.add(id);
        }
        this.data.Properties = this.creatureProperties.filter(x => Compendium.Properties[x.ID].Tags.some(y => tags.has(y)));
        this.renderBody();
    }
}

class Skills extends TabContentWithFilter {
    constructor(content, creatureDetail) {
        const tags = new Set();
        for (const x of creatureDetail.Skills) {
            for (const y of Compendium.Skills[x.ID].Tags) {
                if (!tags.has(y))
                    tags.add(y);
            }
        }
        super(content, 'Skills', { Filter: [...tags], Skills: creatureDetail.Skills.slice() });
        this.tags = tags;
        this.creatureSkills = creatureDetail.Skills;
    }

    get templateNameBody() {
        return 'SkillsBody';
    }

    filterChanged() {
        const tags = new Set();
        for (const v of this.content.querySelectorAll('div.filter > .specific label.checkbox > input[type=checkbox]:checked')) {
            const id = v.closest('label.checkbox').getAttribute('name');
            if (!tags.has(id))
                tags.add(id);
        }
        this.data.Skills = this.creatureSkills.filter(x => Compendium.Skills[x.ID].Tags.some(y => tags.has(y)));
        this.renderBody();
    }
}

class Creature {
    constructor(data) {
        const innateData = data.CreatureInnateData;

        this.Image = innateData.Image || '';

        this.Identities = new Identities(innateData.Identities);

        const creatureRace = Compendium.Races[this.MainIdentity.Race];

        this.Properties = new Map();
        for (const racialProperty of creatureRace.RacialProperties.Items) {
            const p = Compendium.Properties[racialProperty.ID];
            this.Properties.set(racialProperty.ID, { ID: racialProperty.ID, Name: p.Name, Origin: p.Origin.Items.find(x => x === 'Racial Perk') ? 'Racial Perk' : 'Racial Vulnerability' });
        }
        for (const extraProperty of innateData.ExtraProperties) {
            const p = Compendium.Properties[extraProperty.ID];
            this.Properties.set(extraProperty.ID, { ID: extraProperty.ID, Name: p.Name, Origin: extraProperty.Origin });
        }
        for (const p of innateData.AbsentProperties)
            this.Properties.delete(p);

        this.Attributes = {};
        for (const attr in creatureRace.RacialAttributes) {
            const { Mean, StandardDeviation } = creatureRace.RacialAttributes[attr];
            this.Attributes[attr] = Mean + Math.trunc(StandardDeviation * innateData.Attributes[attr]);
        }

        this.Skills = {};
        for (const skill in creatureRace.RacialSkills)
            this.Skills[skill] = { ID: skill, Name: Compendium.Skills[skill].Name, Level: creatureRace.RacialSkills[skill] };
        for (const skill in innateData.Skills) {
            if (this.Skills[skill] === undefined)
                this.Skills[skill] = { ID: skill, Name: Compendium.Skills[skill].Name, Level: innateData.Skills[skill] };
            else
                this.Skills[skill].Level = Math.max(this.Skills[skill].Level, innateData.Skills[skill]);
        }

        this.Traits = new Set();
        for (const trait of innateData.Traits)
            this.Traits.add(trait);

        this.Description = innateData.Description;
    }

    get MainIdentity() {
        return this.Identities.Main;
    }

    static BuildCurrentData(data) {
        const events = data.Events;

        const creature = new Creature(data);

        for (const e of events) {
            if (new Date(e.DateTime) > date)
                break;
            EventExecutor[e.EventType](creature, e.DateTime, ...e.EventArguments);
        }

        const mainIdentity = creature.MainIdentity;
        return {
            Outline: {
                NickName: mainIdentity.NickName
                , Image: creature.Image
                , AbilityEstimation: 1000
                , ProperName: mainIdentity.ProperName
                , Sex: mainIdentity.Sex
                , Race: Compendium.Races[mainIdentity.Race].Name
                , Breed: mainIdentity.Breed
                , Birthdate: mainIdentity.Existent.Birth.formatDate()
                , Deathdate: mainIdentity.Existent.Death ? mainIdentity.Existent.Death.formatDate() : null
                , Age: mainIdentity.Existent.ChronologicalAge
                , Height: null
                , Mass: null
                , Physique: null
                , Whereabouts: mainIdentity.Existent.Whereabouts
                , Literacy: mainIdentity.Literacy
                , Nationality: mainIdentity.Nationality
                , Affiliation: mainIdentity.Affiliation
                , Rank: mainIdentity.Rank
                , Occupation: mainIdentity.Occupation
                , SocialClass: null
                , Religion: mainIdentity.Religion
                , FightingHabit: mainIdentity.FightingHabit
                , Personality: []
                , Description: creature.Description
            }
            , Detail: {
                Profile: creature.Identities.convertToProfile()
                , Attributes: Object.assign({}, creature.Attributes)
                , Properties: Array.from(creature.Properties).map(x => x[1])
                , Skills: Object.keys(creature.Skills).map(id => creature.Skills[id])
                , Traits: Array.from(creature.Traits).map(x => ({ ID: x, Name: Compendium.Traits[x].Name }))
            }
        };
    }
}

class Identities {
    constructor(identities) {
        this.data = [];
        for (const i of identities) {
            this.data.push(new Identity(i));
        }
    }

    get Main() {
        return this.data.find(x => x.IsVisible);
    }

    add(identity) {
        this.data.push(new Identity(identity));
    }

    get(identityKey) {
        return this.data.find(x => x.IdentityKey === identityKey);
    }

    remove(identityKey) {
        this.data.remove(x => x.IdentityKey === identityKey);
    }

    convertToProfile() {
        const visibleIdentities = this.data.filter(x => x.IsVisible);
        return [this.convert(visibleIdentities[0], 0), ...visibleIdentities.slice(1).map((v, i) => this.convert(v, i + 1))];
    }

    convert(identity, index) {
        let age;
        if (identity.Existent.Type !== 'Immortal')
            age = { Age: identity.Existent.ChronologicalAge };
        else {
            age = {
                ChronologicalAge: identity.Existent.ChronologicalAge
                , BiologicalAge: identity.Existent.BiologicalAge
                , ApparentAge: identity.Existent.ApparentAge
            };
        }

        const race = Compendium.Races[identity.Race];
        const genealogicalInfo = identity.GenealogicalInformation;

        return Object.assign({
            ProfileName: index === 0 ? 'Personal Information' : `Alternate Identity #${index}`
            , ProperName: identity.ProperName
            , NickName: identity.NickName
            , Alias: identity.Alias
            , Sex: identity.Sex
            , RacialTags: race.Tags.slice()
            , Race: race.Name
            , Breed: identity.Breed
            , Birthdate: identity.Existent.Birth.formatDate()
            , Deathdate: identity.Existent.Death ? identity.Existent.Death.formatDate() : null
            , Whereabouts: identity.Existent.Whereabouts
            , Literacy: identity.Literacy
            , Nationality: identity.Nationality
            , Birthplace: identity.Birthplace
            , Affiliation: identity.Affiliation
            , Rank: identity.Rank
            , Occupation: identity.Occupation
            , Religion: identity.Religion
            , FightingHabit: identity.FightingHabit
            , Father: genealogicalInfo.Father
            , Mother: genealogicalInfo.Mother
            , Siblings: genealogicalInfo.Siblings.slice()
            , Spouses: genealogicalInfo.Spouses.slice()
            , Children: genealogicalInfo.Children.slice()
        }, age);
    }
}

class Identity {
    constructor(identity) {
        for (const p in identity) {
            if (p !== 'Existent')
                this[p] = identity[p];
            else
                this[p] = new Existent(identity[p]);
        }
    }
}

class Existent {
    constructor(existent) {
        this.Type = existent.Type;
        this.Birth = new Date(existent.Birth);
        if (this.Type === 'Immortal') {
            this.StopAgingDate = new Date(existent.StopAgingDate);
            this.GrowthFactor = existent.GrowthFactor;
        }
        this.Death = existent.Death ? new Date(existent.Death) : null;
        this.Whereabouts = existent.Whereabouts;
    }

    get ChronologicalAge() {
        return this.Birth.calculatePeriodToGivenDate(date || this.Birth).years;
    }

    get BiologicalAge() {
        let min = date > this.StopAgingDate ? this.StopAgingDate : date;
        if (this.Death !== null) {
            min = min > this.Death ? this.Death : min;
        }

        return this.Birth.calculatePeriodToGivenDate(min).years;
    }

    get ApparentAge() {
        return this.BiologicalAge * this.GrowthFactor;
    }
}

class EventExecutor {
    static SetImage(creature, dateTime, imageData) {
        creature.Image = imageData;
    }

    static Kill(creature, dateTime) {
        for (const identity of creature.Identities.filter(x => x.Existent.Death === null))
            identity.Existent.Death = dateTime;
    }

    static AddIdentity(creature, dateTime, identity) {
        creature.Identities.add(identity);
    }

    static SetIdentityNickName(creature, dateTime, identityKey, nickName) {
        creature.Identities.get(identityKey).NickName = nickName;
    }

    static SetIdentityProperName(creature, dateTime, identityKey, properName) {
        creature.Identities.get(identityKey).ProperName = ProperName;
    }

    static SetIdentityAddAlias(creature, dateTime, identityKey, alias) {
        creature.Identities.get(identityKey).Alias.push(alias);
    }

    static SetIdentityRemoveAlias(creature, dateTime, identityKey, alias) {
        creature.Identities.get(identityKey).Alias.remove(x => x === alias);
    }

    static SetIdentitySex(creature, dateTime, identityKey, sex) {
        creature.Identities.get(identityKey).Sex = sex;
    }

    static SetIdentityRace(creature, dateTime, identityKey, race) {
        creature.Identities.get(identityKey).Race = race;
    }

    static SetIdentityBreed(creature, dateTime, identityKey, breed) {
        creature.Identities.get(identityKey).Breed = breed;
    }

    static SetIdentityBirthDate(creature, dateTime, identityKey, birthDate) {
        creature.Identities.get(identityKey).Existent.Birth = new Date(birthDate);
    }

    static SetIdentityDeathDate(creature, dateTime, identityKey, deathDate) {
        creature.Identities.get(identityKey).Existent.Death = new Date(deathDate);
    }

    static SetIdentityWhereabouts(creature, dateTime, identityKey, whereabouts) {
        creature.Identities.get(identityKey).Existent.Whereabouts = whereabouts;
    }

    static SetIdentityLiteracy(creature, dateTime, identityKey, literacy) {
        creature.Identities.get(identityKey).Literacy = literacy;
    }

    static SetIdentityNationality(creature, dateTime, identityKey, nationality) {
        creature.Identities.get(identityKey).Nationality = nationality;
    }

    static SetIdentityAffiliation(creature, dateTime, identityKey, affiliation) {
        creature.Identities.get(identityKey).Affiliation = affiliation;
    }

    static SetIdentityRank(creature, dateTime, identityKey, rank) {
        creature.Identities.get(identityKey).Rank = rank;
    }

    static SetIdentityOccupation(creature, dateTime, identityKey, occupation) {
        creature.Identities.get(identityKey).Occupation = occupation;
    }

    static SetIdentityReligion(creature, dateTime, identityKey, religion) {
        creature.Identities.get(identityKey).Religion = religion;
    }

    static SetIdentityFightingHabit(creature, dateTime, identityKey, fightingHabit) {
        creature.Identities.get(identityKey).FightingHabit = fightingHabit;
    }

    static SetIdentityFather(creature, dateTime, identityKey, fatherName) {
        creature.Identities.get(identityKey).GenealogicalInformation.Father = fatherName;
    }

    static SetIdentityMother(creature, dateTime, identityKey, motherName) {
        creature.Identities.get(identityKey).GenealogicalInformation.Mother = motherName;
    }

    static SetIdentityAddSibling(creature, dateTime, identityKey, siblingName) {
        creature.Identities.get(identityKey).GenealogicalInformation.Siblings.push(siblingName);
    }

    static SetIdentityAddSpouse(creature, dateTime, identityKey, spouseName) {
        creature.Identities.get(identityKey).GenealogicalInformation.Spouses.push(spouseName);
    }

    static SetIdentityAddChild(creature, dateTime, identityKey, childName) {
        creature.Identities.get(identityKey).GenealogicalInformation.Children.push(childName);
    }

    static SetIdentityVisibility(creature, dateTime, identityKey, isVisible) {
        creature.Identities.get(identityKey).IsVisible = isVisible;
    }

    static RemoveIdentity(creature, dateTime, identityKey) {
        creature.Identities.remove(identityKey);
    }

    static AddProperty(creature, dateTime, property, origin) {
        creature.Properties.set(property, { ID: property, Name: Compendium.Properties[property].Name, Origin: origin });
    }

    static RemoveProperty(creature, dateTime, property) {
        creature.Properties.delete(property);
    }

    static SetAttribute(creature, dateTime, attribute, amount) {
        creature.Attributes[attribute] = amount;
    }

    static ChangeAttribute(creature, dateTime, attribute, amount) {
        const newAmount = creature.Attributes[attribute] + amount;
        Current.Attributes[attribute] = newAmount >= 0 ? newAmount: 0;
    }

    static SetSkill(creature, dateTime, skill, amount) {
        if (amount === 0)
            delete creature.Skills[skill];
        else if (creature.Skills[skill])
            creature.Skills[skill].Level = amount;
        else
            creature.Skills[skill] = { ID: skill, Name: Compendium.Skills[skill].Name, Level: amount };
    }

    static ChangeSkill(creature, dateTime, skill, amount) {
        const oldAmount = creature.Skills[skill] ? creature.Skills[skill] : 0;
        const newAmount = oldAmount + amount;
        if (newAmount === 0)
            delete creature.Skills[skill];
        else if (creature.Skills[skill])
            creature.Skills[skill].Level = newAmount;
        else
            creature.Skills[skill] = { ID: skill, Name: Compendium.Skills[skill].Name, Level: amount };
    }

    static AddTrait(creature, dateTime, trait) {
        creature.Traits.add(trait);
    }

    static RemoveTrait(creature, dateTime, trait) {
        creature.Traits.remove(trait);
    }

    static SetDescription(creature, dateTime, description) {
        creature.Description = description;
    }
}
