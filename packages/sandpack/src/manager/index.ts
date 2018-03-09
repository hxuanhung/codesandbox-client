/// <reference types="node" />
import { dispatch, listen, registerFrame } from 'codesandbox-api';
import { getTemplate } from 'codesandbox-import-utils/lib/create-sandbox/templates';

import generatePackageJSON, {
  getPackageJSON,
} from '../utils/generate-package-json';
import version from '../version';

export interface IManagerOptions {
  /**
   * Location of the bundler.
   */
  bundlerURL?: string;
  /**
   * Width of iframe.
   */
  width?: string;
  /**
   * Height of iframe.
   */
  height?: string;
  /**
   * If we should skip the third step: evaluation.
   */
  skipEval?: boolean;
}

export interface IFile {
  code: string;
}

export interface IFiles {
  [path: string]: IFile;
}

export interface IModules {
  [path: string]: {
    code: string;
    path: string;
  };
}

export interface IDependencies {
  [depName: string]: string;
}

export interface ISandboxInfo {
  files: IFiles;
  dependencies?: IDependencies;
  entry?: string;
  /**
   * What template we use, if not defined we infer the template from the dependencies or files.
   *
   * @type {string}
   */
  template?: string;
}

const BUNDLER_URL =
  process.env.CODESANDBOX_ENV === 'development'
    ? 'http://localhost:3001'
    : `https://sandpack-${version.replace(/\./g, '-')}.codesandbox.io`;

export default class PreviewManager {
  selector: string | undefined;
  element: Element;
  iframe: HTMLIFrameElement;
  options: IManagerOptions;
  listener?: Function;
  skipEval: boolean;
  bundlerURL: string;

  sandboxInfo: ISandboxInfo;

  constructor(
    selector: string | HTMLIFrameElement,
    sandboxInfo: ISandboxInfo,
    options: IManagerOptions = {}
  ) {
    this.options = options;
    this.sandboxInfo = sandboxInfo;
    this.bundlerURL = options.bundlerURL || BUNDLER_URL;

    if (typeof selector === 'string') {
      this.selector = selector;
      const element = document.querySelector(selector);

      if (!element) {
        throw new Error(`No element found for selector '${selector}'`);
      }

      this.element = element;
      this.iframe = document.createElement('iframe');
      this.initializeElement();
    } else {
      this.element = selector;
      this.iframe = selector;
    }
    this.iframe.src = this.bundlerURL;

    this.skipEval = options.skipEval || false;

    this.listener = listen((message: any) => {
      switch (message.type) {
        case 'initialized': {
          if (this.iframe) {
            registerFrame(this.iframe.contentWindow);

            this.updatePreview();
          }
          break;
        }
        default: {
          // Do nothing
        }
      }
    });
  }

  updatePreview(sandboxInfo = this.sandboxInfo) {
    this.sandboxInfo = sandboxInfo;

    const files = this.getFiles();

    const modules: IModules = Object.keys(files).reduce(
      (prev, next) => ({
        ...prev,
        [next]: {
          code: files[next].code,
          path: next,
        },
      }),
      {}
    );

    let packageJSON = JSON.parse(
      getPackageJSON(this.sandboxInfo.dependencies, this.sandboxInfo.entry)
    );
    try {
      packageJSON = JSON.parse(files['/package.json'].code);
    } catch (e) {
      console.error('Could not parse package.json file: ' + e.message);
    }

    // TODO move this to a common format
    const normalizedModules = Object.keys(files).reduce(
      (prev, next) => ({
        ...prev,
        [next]: {
          content: files[next].code,
          path: next,
        },
      }),
      {}
    );

    dispatch({
      type: 'compile',
      codesandbox: true,
      version: 3,
      modules,
      externalResources: [],
      template:
        this.sandboxInfo.template ||
        getTemplate(packageJSON, normalizedModules),
      showOpenInCodeSandbox: true,
      skipEval: this.skipEval,
    });
  }

  private getFiles() {
    const { sandboxInfo } = this;

    if (sandboxInfo.files['/package.json'] === undefined) {
      return generatePackageJSON(
        sandboxInfo.files,
        sandboxInfo.dependencies,
        sandboxInfo.entry
      );
    }

    return this.sandboxInfo.files;
  }

  private initializeElement() {
    this.iframe.style.border = '0';
    this.iframe.style.width = this.options.width || '100%';
    this.iframe.style.height = this.options.height || '100%';
    this.iframe.style.overflow = 'hidden';

    if (!this.element.parentNode) {
      // This should never happen
      throw new Error('Given element does not have a parent.');
    }

    this.element.parentNode.replaceChild(this.iframe, this.element);
  }
}