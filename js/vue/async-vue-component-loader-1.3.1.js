class AsyncVueComponentLoader {
    static async load(container, mainJsElement, scriptElements, componentElements, cacheEnabled = false) {
        const componentLoader = new AsyncVueComponentLoader(container, cacheEnabled);
        await componentLoader.loadScripts(scriptElements);
        await componentLoader.loadComponents(componentElements);
        await componentLoader.loadScripts([mainJsElement]);

        return componentLoader;
    }

    constructor(container, cacheEnabled = false) {
        this._container = container;
        this._cacheEnabled = cacheEnabled;
        this._loadedComponents = {};
    }

    async loadScripts(scriptElements) {
        const promises = Array.from(scriptElements).map(scriptElement => this.compileScript(scriptElement));
        const scripts = await Promise.all(promises);

        scripts.forEach(({ path, appFactory }) => {
            const component = appFactory(this);

            if (!component) {
                return;
            }

            this._loadedComponents[path] = component;
        });
    }

    async loadComponents(componentElements) {
        const promises = Array.from(componentElements).map(element => this.compileComponent(element));
        const compiledElements = await Promise.all(promises);

        compiledElements.forEach(({ path, element, styleElement, template, componentFactory }) => {
            if (styleElement.innerHTML) {
                element.after(styleElement);
            }

            const component = componentFactory(this);
            if (!component.template && template) {
                component.template = template;
            }

            this._loadedComponents[path] = component;
        });
    }

    async compileScript(element) {
        const src = element.src;
        const path = this._getPath(src);
        const code = await this._fetchData(src);
        const transpiledCode = this._transpileCode(path, code);
        const factoryCode = this._wrapWithFunction(transpiledCode);

        let appFactory;
        try {
            appFactory = eval(factoryCode);
        } catch (e) {
            e.message += ` (${src})`;
            this.handleError(e);

            throw e;
        }

        return {
            path,
            appFactory
        };
    }

    async compileComponent(element) {
        const src = element.src;
        const path = this._getPath(src);
        const data = await this._fetchData(src);
        const component = this._extractComponent(path, data);

        let componentFactory;
        try {
            componentFactory = eval(component.code);
        } catch (e) {
            e.message += ` (${src})`;
            this.handleError(e);

            throw e;
        }

        return {
            path,
            element,
            componentFactory,
            ...component,
        };
    }

    getLoadedComponent(path) {
        if (this._loadedComponents[path]) {
            return this._loadedComponents[path];
        }

        if (this._container[path]) {
            return this._container[path];
        }

        const capitalizedKey = this._upperCaseFirstLetter(path);
        if (this._container[capitalizedKey]) {
            return this._container[capitalizedKey];
        }

        throw new Error(`Component not found: '${path}'`);
    }

    handleError(error) {
        console.error(error.message);
        console.error(error.stack);
    }

    async _fetchData(url) {
        const cache = this._cacheEnabled ? 'default' : 'no-store';
        const response = await fetch(url, { cache });

        return response.text();
    }

    _getPath(url) {
        return new URL(url).pathname;
    }

    _getPathArray(path) {
        return path.substring(1).split('/');
    }
    
    _getFileExtension(path) {
        const fileName = this._getPathArray(path).pop();

        return fileName.includes('.') ? fileName.split('.').pop() : '';
    }

    _normalizePath(path, currentPaths) {
        if (!path.includes('/')) {
            return path;
        }

        const paths = path.split('/');
        const changeDirCount = paths.filter(dir => dir === '..').length;
        const pathsWithoutChangeDirs = paths.filter(dir => dir !== '.' && dir !== '..');
        const newPaths = (changeDirCount > 0 ? currentPaths.slice(0, -changeDirCount) : currentPaths)
            .concat(pathsWithoutChangeDirs);

        return '/' + newPaths.join('/');
    }

    _extractComponent(path, data) {
        const wrapperElement = this._createElement('div', data);
        const styleElement = this._extractStyleElement(wrapperElement);
        const template = this._extractTemplate(wrapperElement);
        const code = this._extractScript(path, wrapperElement);

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

    _extractScript(path, dataElement) {
        const scriptElement = dataElement.querySelector('script');

        if (!scriptElement) {
            return `() => ({})`;
        }

        return this._wrapWithFunction(this._transpileCode(path, scriptElement.innerHTML));
    }

    _transpileCode(currentPath, code) {
        const pathsWithoutFileName = this._getPathArray(currentPath).slice(0, -1);

        const transpiledCode = code
            .replace(/export default/g, 'return')
            .replace(/import (.*) from (.*);/g, (matches, variableName, path) => {
                let normalizedPath = this._normalizePath(path.replace(/['"]/g, ''), pathsWithoutFileName);
                if (normalizedPath.startsWith('/') && this._getFileExtension(normalizedPath) === '') {
                    normalizedPath += '.js';
                }

                return `const ${variableName} = __loader.getLoadedComponent('${normalizedPath}');`;
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
        return `(__loader) => {\ntry {\n${code}\n} catch(e) {\n__loader.handleError(e);\n}\n}`;
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
