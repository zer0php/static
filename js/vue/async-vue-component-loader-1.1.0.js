class AsyncVueComponentLoader {
    static async load(container, mainJsElement, componentElements, cacheEnabled = false) {
        const componentLoader = new AsyncVueComponentLoader(container, componentElements, cacheEnabled);
        await componentLoader.loadComponents();
        await componentLoader.loadMainJs(mainJsElement);

        return componentLoader;
    }

    constructor(container, componentElements, cacheEnabled = false) {
        this._container = container;
        this._componentElements = Array.from(componentElements);
        this._loadedComponents = {};
        this._cacheEnabled = cacheEnabled;
    }

    async loadComponents() {
        const compiledElements = await Promise.all(
            this._componentElements.map(element => this.compile(element))
        );

        compiledElements.forEach(({componentName, element, styleElement, template, componentFactory}) => {
            if (styleElement.innerHTML) {
                element.after(styleElement);
            }

            const component = componentFactory(this);
            if (!component.template && template) {
                component.template = template;
            }

            this._loadedComponents[componentName] = component;
        });
    }

    async loadMainJs(scriptElement) {
        const data = await this._fetchData(scriptElement.src);
        const appFactory = eval(this._wrapWithFunction(this._transpile(data)));

        appFactory(this);
    }

    getLoadedComponent(fileName) {
        const componentName = this._getComponentName(fileName);

        if (this._loadedComponents[componentName]) {
            return this._loadedComponents[componentName];
        }

        if (this._container[componentName]) {
            return this._container[componentName];
        }

        const capitalizedComponentName = this._upperCaseFirstLetter(componentName);
        if (this._container[capitalizedComponentName]) {
            return this._container[capitalizedComponentName];
        }

        throw new Error(`Component not found: ${fileName}`);
    }

    async compile(element) {
        const url = element.src;
        const data = await this._fetchData(url);
        const component = this._extractComponent(data);

        return {
            ...component,
            element,
            componentName: this._getComponentName(url),
            componentFactory: eval(component.code)
        };
    }

    async _fetchData(url) {
        const response = await fetch(url, { cache: this._cacheEnabled ? 'default' : 'no-store' });

        return await response.text();
    }

    _getComponentName(file) {
        const fileName = file.split('/').reverse()[0];

        return fileName.replace('.vue', '');
    }

    _extractComponent(data) {
        const wrapperElement = this._createElement('div', data);
        const styleElement = this._extractStyleElement(wrapperElement);
        const template = this._extractTemplate(wrapperElement);
        const code = this._extractScript(wrapperElement);

        return { wrapperElement, styleElement, template, code };
    }

    _extractStyleElement(dataElement) {
        return dataElement.querySelector('style') || this._createElement('style');
    }

    _extractTemplate(dataElement) {
        const element = dataElement.querySelector('template');

        if (!element) {
            return '';
        }

        return element.innerHTML;
    }

    _extractScript(dataElement) {
        const scriptElement = dataElement.querySelector('script');

        if (!scriptElement) {
            return `(() => ({}))`;
        }

        return this._wrapWithFunction(this._transpile(scriptElement.innerHTML));
    }

    _transpile(code) {
        return code
            .replace(/export default/g, 'return')
            .replace(/import (.*) from (.*);/g, function(matches, variableName, componentName) {
                return `const ${variableName} = __loader.getLoadedComponent(${componentName});`;
            })
            .replace(/import .*;/g, '')
            .trim();
    }

    _wrapWithFunction(code) {
        return `((__loader) => {\n${code}\n})`;

    }

    _upperCaseFirstLetter(name) {
        return name[0].toUpperCase() + name.slice(1);
    }

    _createElement(tag, html = '') {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }
}
