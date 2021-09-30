class AsyncVueComponentLoader {
    static ignoreAsyncElements() {
        Vue.config.ignoredElements.push(/async$/);
    }

    static getComponentTemplateDecoratorModule() {
        return {
            currentComponent: null,
            get exports() {
                return this.currentComponent;
            },
            set exports(component) {
                component.template = '#' + component.name;
                this.currentComponent = component;
            }
        };
    }

    constructor(componentElements, cacheEnabled = false) {
        this._componentElements = Array.from(componentElements);
        this._cacheEnabled = cacheEnabled;
    }

    async loadComponents() {
        return await Promise.all(
            this._componentElements.map(element => this.loadComponent(element))
        );
    }

    async loadComponent(element) {
        const file = element.src;
        const response = await fetch(file, { cache: this._cacheEnabled ? 'default' : 'no-store' });
        const data = await response.text();
        const componentName = this._getComponentName(file);

        const elements = this._extractElementsFromData(data, componentName);
        this._appendToElement(element, elements);

        return elements;
    }

    _getComponentName(file) {
        const fileName = file.split('/').reverse()[0];

        return fileName.replace('.vue', '');
    }

    _appendToElement(element, {styleElement, templateElement, jsElement}) {
        element.appendChild(styleElement);
        element.appendChild(templateElement);
        element.appendChild(jsElement);

        return element;
    }

    _extractElementsFromData(data, componentName) {
        const dataElement = this._createElement('div', data);
        const styleElement = this._extractStyleElement(dataElement);
        const templateElement = this._extractTemplateElement(dataElement, componentName);
        const jsElement = this._extractJavascriptElement(dataElement);

        return { dataElement, styleElement, templateElement, jsElement };
    }

    _extractStyleElement(dataElement) {
        return dataElement.querySelector('style') || this._createElement('style');
    }

    _extractTemplateElement(dataElement, componentName) {
        const element = dataElement.querySelector('template') || this._createElement('template');

        element.id = componentName.split('/').reverse()[0];

        return element;
    }

    _extractJavascriptElement(dataElement) {
        const scriptElement = dataElement.querySelector('script');
        const html = scriptElement ? scriptElement.innerHTML : '';

        return this._createElement('script', html);
    }

    _createElement(tag, html = '') {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }
}
