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
        this._compoentsDir = componentsDir;
    }

    loadVueComponents(componentNames) {
        componentNames.forEach(componentName => this.loadComponent(componentName));
    }

    loadComponent(componentName) {
        const file = `${this._compoentsDir}${componentName}.vue`;
        fetch(file)
            .then(response => response.text())
            .then(data => {
                const dataElement = this._createElement('div', data);
                this._registerElement(this._createTemplateElement(dataElement, componentName));
                this._registerElement(this._createJavascriptElement(dataElement));
            });
    }

    _createTemplateElement(dataElement, componentName) {
        const element = this._createElement(
            'template',
            dataElement.querySelector('template')?.innerHTML
        );
        element.id = componentName.split('/').reverse()[0];

        return element;
    }

    _createJavascriptElement(dataElement) {
        return this._createElement(
            'script',
            dataElement.querySelector('script')?.innerHTML
        );
    }

    _registerElement(element) {
        document.body.appendChild(element);
    }

    _createElement(tag, html) {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }
}
