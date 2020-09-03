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
                const dataElement = this._createElement('div', data);
                const templateElement = this._createTemplateElement(dataElement, componentName);
                const jsElement = this._createJavascriptElement(dataElement);
                
                this._registerElement(templateElement);
                this._registerElement(jsElement);

                return Promise.resolve({
                    dataElement,
                    templateElement,
                    jsElement
                });
            });
    }

    _createTemplateElement(dataElement, componentName) {
        const element = this._createElement(
            'template',
            this._extractHtmlFromElementAndTag(dataElement, 'template')
        );
        element.id = componentName.split('/').reverse()[0];

        return element;
    }

    _createJavascriptElement(dataElement) {
        return this._createElement(
            'script',
            this._extractHtmlFromElementAndTag(dataElement, 'script')
        );
    }
    
    _extractHtmlFromElementAndTag(element, tag) {
        const el = element.querySelector(tag);
        
        if (!el) {
            return '';
        }
        
        return el.innerHTML;
    }
    
    _createElement(tag, html) {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }

    _registerElement(element) {
        document.body.appendChild(element);
    }
}