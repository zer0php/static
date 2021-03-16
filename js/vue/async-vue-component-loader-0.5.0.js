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

    constructor(componentElements) {
        this._componentElements = Array.from(componentElements);
    }

    async loadComponents() {
        return await Promise.all(
            this._componentElements.map(element => this.loadFile(element.src))
        );
    }

    async loadFile(file) {
        const response = await fetch(file);
        const data = await response.text();
        const componentName = this._getComponentName(file);

        const elements = this._extractElementsFromData(data, componentName);
        const wrapperElement = this._createWrapperElement(elements);

        this._registerElement(wrapperElement);

        return elements;
    }

    _getComponentName(file) {
        const fileName = file.split('/').reverse()[0];

        return fileName.replace('.vue', '');
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

    _registerElement(element) {
        document.body.appendChild(element);
    }
}
