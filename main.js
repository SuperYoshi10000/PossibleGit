/*********
 Extension
**********/


/*********
 Main Code 
**********/

/** 
 * @extends {Map<string, Branch>} 
 */
class Repository extends Map {
    /** @type {string} */
    remoteUrl;
    /** @type {string} */
    name;
    /** @type {string} */
    #dirpath;
    get path() {
        return this.#dirpath;
    }
    get directory() {
        return new FileSystemDirectoryHandle();
    }

    get activeBranch() {
        return this.get(this.#activeName);
    }
    /**
     * 
     * @param {string | Branch} branch
     */
    set activeBranch(branch) {
        if (branch instanceof Branch) this.#activeName = branch.name;
        else this.#activeName = branch;
        return branch;
    }

    get mainBranch() {
        return this.get(this.#mainName);
    }
    /**
     * 
     * @param {string | Branch} branch
     */
    set mainBranch(branch) {
        if (branch instanceof Branch) this.#mainName = branch.name;
        else this.#mainName = branch;
        return branch;
    }

    /** @type {string} */
    #mainName;
    /** @type {string} */
    #activeName;
    
    /**
     * 
     * @param {string} url 
     * @param {string} name 
     * @param {string} path 
     * @param {Branch[]|Map<string, Branch>?} branches 
     */
    constructor(url, name, path, branches) {
        this.remoteUrl = url;
        this.name = name;
        this.#dirpath = path;
        
        if (branches instanceof Map) branches.forEach((v, k) => this.set(k, v));
        else if (branches instanceof Array) branches.forEach(b => this.set(b, b.name))
    }

    /**
     * 
     * @param {Branch} v 
     * @returns {this}
     */
    add(v) {
        return this.set(v.name, v);
    }
    /**
     * 
     * @param {...Branch} v 
     * @returns {this}
     */
    addAll(...v) {
        v.forEach(b => this.set(b, b.name));
        return this;
    }

    branches() {
        return Array.from(this.values());
    }
    
    /**
     * 
     * @param {string} url 
     * @param {string} name 
     * @param {string} path 
     * @param {boolean} mainOnly 
     * @returns {Repository}
     */
    fork(url, name, path, mainOnly = false) {
        const repository = new Repository(url, name, path);
        repository.#mainName = this.#mainName;
        if (mainOnly) repository.add(this.mainBranch);
        else repository.addAll(this);
        repository.#activeName = mainOnly ? this.#mainName : this.#activeName;
        return repository;
    }

    serialize() {
        const obj = {};
        for (let [k, v] of this) {
            obj[k] = v.path;
        }
        return {
            url: this.remoteUrl,
            name: this.name,
            path: this.path,
            branches: obj
        };
    }
    stringify() {
        return JSON.stringify(this.serialize());
    }

    /**
     * 
     * @param {FileSystemDirectoryHandle} dir 
     */
    async saveToFile(dir) {
        await dir.getDirectoryHandle(".git-crx").getFileHandle("repoinfo.json").then(f => f.createWritable()).then(f => f.write(this.stringify()));
    }
}

class Branch {
    static #encode = new TextEncoder().encode;
    static #decode = new TextDecoder().decode;
    /** @type {Repository} */
    repository;
    /** @type {string} */
    name;
    /** @type {string} */
    path;

    /** @type {string[][]} */
    #filepaths;

    get absolutePath() {
        return this.repository.path + "/" + this.path;
    }

    /**
     * 
     * @param {Repository} repository 
     * @param {string} name 
     * @param {string} path 
     */
    constructor(repository, name, path) {
        this.name = name;
        this.path = path;
        this.repository = this.repository;
    }

    /**
     * 
     * @param {Branch} branch 
     * @returns {boolean}
     */
    mergeTo(branch) {
        try {
            return true;
        } catch(e) {
            return false;
        }
    }
    mergeToActive() {
        return this.mergeTo(this.repository.activeBranch);
    }
    /**
     * 
     * @param {Branch} branch 
     * @returns {boolean}
     */
    mergeFrom(branch) {
        return branch.mergeTo(this);
    }
    mergeFromActive() {
        return this.repository.activeBranch.mergeTo(this);
    }

    /**
     * 
     * @returns {Map<string, File>}
     */
    async files() {
        let l = new Array(this.#filepaths.length);
        for (let p of this.#filepaths) {
            let f = this.repository.directory;
            for (let i of p.slice(0, -1)) f = await f.getDirectoryHandle(i);
            l.push(await((await f.getFileHandle(p[p.length - 1])).getFile()));
        }
        return l;
    }

    async serialize() {
        const obj = {};
        const files = this.files(); // TODO get files
        for (let [k, v] of files) {
            obj[k] = Branch.#decode(crypto.subtle.digest("SHA-256", new Uint8Array(await v.arrayBuffer())));
        }
        return obj;
    }
    
    /**
     * 
     * @param {NonNullable<object>} a 
     * @param {NonNullable<object>} b 
     * @returns {boolean}
     */
    async compare(a, b) {
        for (let k in a) {
            if (b[k] && a[k] != b[k]) return false;
        }
        return true;
    }
}


/**********
 File Saver
***********/
/**
 * @type {Promise<FileSystemDirectoryHandle>}
 */
let directory = showDirectoryPicker();

/**
 * 
 * @param {string[]} fileurls 
 * @param {Promise<FileSystemDirectoryHandle>} dir 
 */
async function saveFiles(fileurls, dir) {
    return await dir.then(handle => saveFiles(fileurls, handle));
}

/**
 * 
 * @param {string[]} fileurls
 * @param {FileSystemDirectoryHandle} dir
 */
async function saveFiles(fileurls, dir) {
    await DownloadFiles(dir, fileurls.map(url => ({ url: url })), { overrideExistingFile: true })
}

export class Exceptions {
    static MetadataError = class MetadataError extends Error {
        constructor(error) {
            super(error);
        }
    }
    static DownloadError = class DownloadError extends Error {
        constructor(error) {
            super(error);
        }
    }
    static FileExistError = class FileExistError extends Error {
        constructor(error) {
            super(error);
        }
    }
    static InternalError = class InternalError extends Error {
        constructor(error) {
            super(error);
        }
    }

    static GeneralError = class GeneralError extends Error {
        innerException;
        constructor(error, innerException) {
            super(error);
            this.innerException = innerException;
        }
    }
}
/**
 * 
 * @param {string} urlStr 
 * @returns 
 */
function getFilenameFromUrl(urlStr) {
    const url = new URL(urlStr, window.location.href);
    const pathname = url.pathname;
    const parts = pathname.split('/');
    return parts.pop();
}

/**
 * 
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @param {string} reqFilename 
 * @param {number} size 
 * @returns {Promise<boolean>}
 */
export async function VerifyFileSize(dirHandle, reqFilename, size) {
    try {
        const fileHandle = await dirHandle.getFileHandle(reqFilename)
        const file = await fileHandle.getFile();
        return file.size === size;
    } catch (ex) {
        return false;
    }
}

/** @enum */
export class DownloadFileRet {
    static SKIPPED_EXIST = 1;
    static DOWNLOADED = 2
}
/**
 * 
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @param {{url: string; size?: number; fileName?: string;}[]} files 
 * @param {{overrideExistingFile?: boolean; abortSignal?: AbortSignal; onStateUpdate?: (url: string, update: { progress?: ProgressState, error?: Error, state?: FileState }) => void;}} options
 * @returns {Promise<DownloadFileRet>} 
 */
export async function DownloadFile(dirHandle, fileDesc, options = {}) {
    const filename = fileDesc.fileName === undefined ? getFilenameFromUrl(fileDesc.url) : fileDesc.fileName;
    if (filename === undefined) {
        throw new Exceptions.MetadataError("Could not determine filename.");
    }

    if (fileDesc.size !== undefined && await VerifyFileSize(dirHandle, filename, fileDesc.size)) {
        return DownloadFileRet.SKIPPED_EXIST;
    }

    if (options.overrideExistingFile !== true) {
        try {
            await dirHandle.getFileHandle(filename, { create: false });
            throw new Exceptions.FileExistError(`File '${filename}' does already exist.`);
        } catch (ex) {
            if(ex instanceof Exceptions.FileExistError) {
                throw ex;
            }
            else if (ex.name === undefined || ex.name !== "NotFoundError") {
                throw new Exceptions.FileExistError(`File: '${filename}' does already exist. Exeption: ${ex.message}`);
            }
        }
    }

    const abortController = new AbortController();
    const response = await fetch(fileDesc.url, { signal: abortController.signal });
    if (!response.ok) {
        throw new Exceptions.DownloadError(`Error while downloading: ${response.status} - ${response.statusText}`);
    }
    if (response.body === null) {
        throw new Exceptions.DownloadError(`No data`);
    }
    let responseStream = response.body;
    if (options.progress !== undefined) {
        let loadedBytes = 0;
        const totalBytesStr = response.headers.get("content-length");
        const totalBytes = Number.parseInt(totalBytesStr ?? '') || undefined;
        const progress = new TransformStream(
            {
                transform(chunk, controller) {
                    loadedBytes += chunk.length;
                    let precent = totalBytes !== undefined ? (loadedBytes / totalBytes) * 100 : undefined;
                    if (options.progress === undefined) {
                        return;
                    }
                    try {
                        options.progress(loadedBytes, totalBytes, precent);
                    }
                    catch (ex) {
                        // Exception in called funciton. Log and continue
                        console.log(ex);
                    }
                    controller.enqueue(chunk);
                }
            }
        );
        responseStream = responseStream.pipeThrough(progress);
    }

    try {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writeable = await fileHandle.createWritable();
        await responseStream.pipeTo(writeable);
    } catch (ex) {
        // Abort possible pending request. (e.g. no permissions to create file, ...)
        abortController.abort();
        throw new Exceptions.GeneralError(`Download of file ${filename} failed due to an exception: ${ex?.message}`, ex);
    }

    return DownloadFileRet.DOWNLOADED;
}

/** @enum */
export class FileState {
    static STARTED = 1;
    static COMPLETED_DOWNLOAD = 2;
    static SKIPPED_EXIST = 3;
    static ERROR = 4;
}

/**
 * 
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @param {{url: string; size?: number; fileName?: string;}[]} files 
 * @param {{overrideExistingFile?: boolean; abortSignal?: AbortSignal; onStateUpdate?: (url: string, update: { progress?: {totalBytes?: number; percent?: number; bytes: number;}, error?: Error, state?: FileState }) => void;}} options 
 */
export async function DownloadFiles(dirHandle, files, options) {
    if (options === undefined) {
        options = {};
    }
    const internalAbort = new AbortController();
    const abortController = options.abortSignal === undefined ? internalAbort.signal : options.abortSignal;
    // TODO use parallel tasks? https://github.com/SGrondin/bottleneck#-using-asyncawait
    for (const dlFile of files) {
        if (abortController.aborted) {
            break;
        }
        const progressCallback = options.onStateUpdate === undefined ? undefined : (bytes, totalBytes, percent) => {
            options?.onStateUpdate?.(dlFile.url, {
                progress: {
                    bytes: bytes,
                    totalBytes: totalBytes,
                    percent: percent
                }
            });
        }
        const dlOpt = {
            overrideExistingFile: options.overrideExistingFile,
            progress: progressCallback,
        }
        options?.onStateUpdate?.(dlFile.url, {
            state: FileState.STARTED
        });
        try {
            // TODO Forward abortController
            const ret = await DownloadFile(dirHandle, dlFile, dlOpt);
            switch (ret) {
                case DownloadFileRet.DOWNLOADED:
                    options?.onStateUpdate?.(dlFile.url, {
                        state: FileState.COMPLETED_DOWNLOAD
                    });
                    break;
                case DownloadFileRet.SKIPPED_EXIST:
                    options?.onStateUpdate?.(dlFile.url, {
                        state: FileState.SKIPPED_EXIST
                    });
                    break;
                default:
                    // Should never happen
                    throw new Exceptions.InternalError(`Unknown return value from download function: ${ret} `);
            }

        } catch (ex) {
            options?.onStateUpdate?.(dlFile.url, {
                state: FileState.ERROR,
                error: ex
            });
        }
    }
}