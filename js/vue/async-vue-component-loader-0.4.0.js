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

    constructor(componentsDir) {
        this._componentsDir = componentsDir;
    }

    async loadComponents(componentNames) {
        return Promise.all(
            componentNames.map(componentName => this.loadComponent(componentName))
        );
    }

    async loadComponent(componentName) {
        const file = `${this._componentsDir}${componentName}.vue`;

        return fetch(file)
            .then(response => response.text())
            .then(data => {
                const elements = this._extractElementsFromData(data, componentName);
                const wrapperElement = this._createWrapperElement(elements);

                this._registerElement(wrapperElement);

                return Promise.resolve(elements);
            });
    }

    _createWrapperElement({styleElement, templateElement, jsElement}) {
        const wrapperElement = this._createElement('div');
        wrapperElement.appendChild(styleElement);
        wrapperElement.appendChild(templateElement);
        wrapperElement.appendChild(jsElement);

        return wrapperElement;
    }

    _extractElementsFromData(data, componentName) {
        const dataElement = this._createElement('div', data);
        const styleElement = this._extractStyleElement(dataElement);
        const templateElement = this._ectractTemplateElement(dataElement, componentName);
        const jsElement = this._extractJavascriptElement(dataElement);

        return { dataElement, styleElement, templateElement, jsElement };
    }

    _extractStyleElement(dataElement) {
        return dataElement.querySelector('style') || this._createElement('style');
    }

    _ectractTemplateElement(dataElement, componentName) {
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

    _registerElement(element) {
        document.body.appendChild(element);
    }
}
