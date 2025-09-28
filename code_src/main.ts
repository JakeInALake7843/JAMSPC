// this file is probably like O(25n^6)
// so many loops

const BasePath = "image_src";
const URL = "https://raw.githubusercontent.com/JakeInALake7843/JAMSPC/refs/heads/main/";


let allFiles: string[] = [];
const versions: Record<string, string[]> = {};

{
	const stack : string[] = [BasePath];
	let iterations = 0;
	const maxInterations = 999;
	while (stack.length > 0 && iterations < maxInterations) {
		const thisPath = stack.pop();
		if (!thisPath) continue;
		const items = Deno.readDirSync(thisPath).toArray();
		const files = items
		.filter((e)=>e.isFile)
		.filter((e)=> {
			const validExt: string[] = ["png", "jpg"];
			const len = e.name.length;
			const ext = e.name.substring(len - 3);
			return validExt.includes(ext);
		})
		.filter((e) => {
			const names: string[] = ["canvas.png", "blank.png", "cover.png"];
			return !names.includes(e.name.toLowerCase())
		});
		const folders = items.filter((e)=>!e.isFile);
		if (folders.length > 0) {
			const mapped = folders.map((entry)=> `${thisPath}/${entry.name}`);
			stack.push(...mapped); // i love javascript!!!
		}

		if (files.length > 0) {
			const mappedFiles = files.map((entry)=> `${thisPath}/${entry.name}`);
			allFiles.push(...mappedFiles);
		}


		iterations++;
	}
}

allFiles.sort((a, b) => {
	const pathA = a.replace("-", " ").split("/");
	const pathB = b.replace("-", " ").split("/");
	const minLength = Math.min(pathA.length, pathB.length);
	for (let i = 0; i < minLength; i++) {
		if (pathA[i] == pathB[i]) continue;
		const thisA = pathA[i].split(" ");
		const thisB = pathB[i].split(" ");
		const minLength = Math.min(thisA.length, thisB.length);
		for (let i = 0; i < minLength; i++) {
			const subA = thisA[i];
			const subB = thisB[i];
			if (subA == subB) continue;
			const parsedA = parseInt(subA);
			const parsedB = parseInt(subB);
			if (!Number.isNaN(parsedA) && !Number.isNaN(parsedB)) return parsedA - parsedB;
			return subA.localeCompare(subB);
		}
		return pathA[i].localeCompare(pathB[i]);
	}
	return pathA.join("/").localeCompare(pathB.join("/"));
});

allFiles = allFiles.map((value)=>value.substring(BasePath.length + 1));

function onlyUnique(value: string, index: number, array: string[]) {
	return array.indexOf(value) === index;
}

const versionList: string[] = allFiles
.map((v)=>v.split("/").shift() ?? "")
.filter(onlyUnique);
versionList.forEach((v)=>{
	versions[v]=[];
});

allFiles.forEach((file) => {
	const filename = file.substring(file.indexOf("/"));
	const folder = file.split("/").shift();
	if (folder) {
		versions[folder].push(filename);
	}
})

interface chapterGroup {
	JAMSPC: string[];
}

interface chapterData {
	title: string;
	groups: chapterGroup;
	last_updated: string;
}

interface metadata {
	title: string;
    description: string;
    artist: string;
	author: string;
    cover: string;
    chapters: Record<string, chapterData>;
}

interface details {
	"title": string;
	"description": string;
	"artist": string;
	"author": string;
	"chapters": Record<string, string>;
}

Object.keys(versions).forEach(async (key) => {
	const metaFilePath = BasePath + "/" + key + "/details.json";
	const chapterDetails : details = JSON.parse(Deno.readTextFileSync(metaFilePath));

	const versionFiles = versions[key];

	const getFullPath = (file: string) => URL + BasePath + "/" + key + file;

	const outputChapters : Record<string, chapterData> = {};

	const chapterKeys = Object.keys(chapterDetails.chapters);

	for (const chapter of chapterKeys)  {
		const thisChapterFiles = versionFiles.filter((file) => {
			const chapterName = file.split("/")[1];
			const num = parseInt(chapterName.replace(/[^0-9]+/g, ""));
			if (Number.isNaN(num)) return false;
			if (parseInt(chapter) == num) return true;
			return false;
		})
		let lastUpdatedTime: number = 0;
		for (const file of thisChapterFiles) {
			const stat = await Deno.lstat(BasePath + "/" + key + file);
			const updateTime = Math.floor((stat.mtime ?? stat.ctime ?? new Date()).getTime() / 1000);
			if (updateTime > lastUpdatedTime) lastUpdatedTime = updateTime;
		}
		outputChapters[chapter] = {
			title: chapterDetails.chapters[chapter],
			last_updated: lastUpdatedTime.toString(),
			groups: {JAMSPC: thisChapterFiles.map(getFullPath)}
		};
	}
	const Output : metadata = {
		title: chapterDetails.title,
		description: chapterDetails.description,
		artist: chapterDetails.artist,
		author: chapterDetails.author,
		cover: URL + BasePath + "/" + key + "/cover.png",
		chapters: outputChapters
	}
	Deno.writeTextFileSync(`story_${key.toLowerCase()}.json`, JSON.stringify(Output, null, 4));
})