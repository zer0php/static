class AsyncVueComponentLoader {
    static async load(container, mainJsElement, scriptElements, componentElements, cacheEnabled = false) {
        const componentLoader = new AsyncVueComponentLoader(container, cacheEnabled);
        await componentLoader.loadScripts(Array.from(scriptElements));
        await componentLoader.loadComponents(Array.from(componentElements));
        await componentLoader.loadScripts([mainJsElement]);

        return componentLoader;
    }

    constructor(container, cacheEnabled = false) {
        this._container = container;
        this._cacheEnabled = cacheEnabled;
        this._loadedComponents = {};
    }

    async loadScripts(scriptElements) {
        const scripts = await Promise.all(
            scriptElements.map(scriptElement => this.compileScript(scriptElement))
        );
        scripts.forEach(script => {
            const component = script.appFactory(this);

            if (!component) {
                return;
            }

            this._loadedComponents[script.name] = component;
        });
    }

    async loadComponents(componentElements) {
        const compiledElements = await Promise.all(
            componentElements.map(element => this.compileComponent(element))
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

    async compileScript(element) {
        const url = element.src;
        const name = this._getComponentName(url);
        const code = await this._fetchData(url);
        const transpiledCode = this._transpileCode(code);
        const factoryCode = this._wrapWithFunction(transpiledCode);

        let appFactory;
        try {
            appFactory = eval(factoryCode);
        } catch (e) {
            e.message += ` (${name} - ${url})`;

            throw e;
        }

        return {
            name,
            appFactory
        };
    }

    async compileComponent(element) {
        const url = element.src;
        const data = await this._fetchData(url);
        const component = this._extractComponent(data);
        const componentName = this._getComponentName(url);

        let componentFactory;
        try {
            componentFactory = eval(component.code);
        } catch (e) {
            e.message += ` (${componentName} - ${url})`;

            throw e;
        }

        return {
            ...component,
            element,
            componentName,
            componentFactory
        };
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

        throw new Error(`Component not found: ${componentName} (${fileName})`);
    }

    async _fetchData(url) {
        const response = await fetch(url, { cache: this._cacheEnabled ? 'default' : 'no-store' });

        return await response.text();
    }

    _getComponentName(file) {
        const fileName = file.split('/').reverse()[0];

        return fileName
            .replace('.vue', '')
            .replace('.js', '');
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
            return `() => ({})`;
        }

        return this._wrapWithFunction(this._transpileCode(scriptElement.innerHTML));
    }

    _transpileCode(code) {
        const transpiledCode = code
            .replace(/export default/g, 'return')
            .replace(/import (.*) from (.*);/g, function(matches, variableName, componentName) {
                return `const ${variableName} = __loader.getLoadedComponent(${componentName});`;
            })
            .replace(/import .*;/g, '')
            .trim();

        return this._transpileExports(transpiledCode);
    }

    _transpileExports(code) {
        const exportMatches = [...code.matchAll(/export [^\s]+ ([^\s(]+)/g)];

        if (exportMatches.length === 0) {
            return code;
        }

        const codeWithoutExports = code.replace(/export /g, '');
        const constants = exportMatches.map(exportMatch => exportMatch[1]);

        return codeWithoutExports + `\n` + `return {${constants.join(', ')}};`;
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
