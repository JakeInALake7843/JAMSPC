// Folder that contains images
const BasePath = "image_src";
// base Github link for raw files
const URL = "https://raw.githubusercontent.com/JakeInALake7843/JAMSPC/refs/heads/main/";

// Every file in images (except for ignored files)
let allFiles: string[] = [];
// Every "version", and the files inside of said version
const versions: Record<string, string[]> = {};

// Block statement. All variables inside are only accesible inside, as to not flood everything else
{
	// How many times to run the loop. Each folder takes 1 loop, files take none.
	const maxInterations = 999;
	// How deep should the checker be limited to
	// 3 = Base/Version/Chapter/[files]
	const maxPathDepth = 3;
	// Extensions to include. only image types.
	const validExt: string[] = ["png", "jpg"];
	// Files to ignore. canvas/blank are templates, cover is found manually later
	const ignoredFiles: string[] = ["canvas.png", "blank.png", "cover.png"];

	// Stack-based searcher using while loop. Start with base path, and add every found folder into the stack, and repeat.
	const stack : string[] = [BasePath];
	let iterations = 0;
	while (stack.length > 0 && iterations < maxInterations) {
		const thisPath = stack.pop();
		if (!thisPath) continue;
		if (thisPath.split("/").length > maxPathDepth) continue;
		// Get all the items inside of the current searching directory
		// Find files by filtering if is not a folder, checking to see if extension is valid and checking to see if file is not ignored
		// Find folders by filtering if is a folder. thats it.
		const items = Deno.readDirSync(thisPath).toArray();
		const files = items
		.filter((e)=>e.isFile)
		.filter((e)=> {
			const len = e.name.length;
			const ext = e.name.substring(len - 3);
			return validExt.includes(ext);
		})
		.filter((e) => {
			return !ignoredFiles.includes(e.name.toLowerCase())
		});
		const folders = items.filter((e)=>!e.isFile);
		// If folders found, add them all into the stack with the full relative path
		if (folders.length > 0) {
			const mapped = folders.map((entry)=> `${thisPath}/${entry.name}`);
			stack.push(...mapped);
		}
		// If files found, add them to the file list with the full relative path.
		if (files.length > 0) {
			const mappedFiles = files.map((entry)=> `${thisPath}/${entry.name}`);
			allFiles.push(...mappedFiles);
		}

		// Prevent it from going on for too long
		iterations++;
	}
}

// "Segment sort"
allFiles.sort((a, b) => {
	// Path looks something like Base/Version/Chapter-1/1.png
	// Remove spaces, replace with -
	const pathA = a.replace(" ", "-").split("/");
	const pathB = b.replace(" ", "-").split("/");
	const minLength = Math.min(pathA.length, pathB.length);
	for (let i = 0; i < minLength; i++) {
		// Base,Version,Chapter-1,1.png
		// If this segment is equal, ignore
		if (pathA[i] == pathB[i]) continue;
		const thisA = pathA[i].split("-");
		const thisB = pathB[i].split("-");
		const minLength = Math.min(thisA.length, thisB.length);
		for (let i = 0; i < minLength; i++) {
			// [Base],[Version],[Chapter,1],1.png
			const subA = thisA[i];
			const subB = thisB[i];
			if (subA == subB) continue;
			// If both segments are a number, compare them and return
			const parsedA = parseInt(subA);
			const parsedB = parseInt(subB);
			if (!Number.isNaN(parsedA) && !Number.isNaN(parsedB)) return parsedA - parsedB;
			// Otherwise, use a text comparison
			return subA.localeCompare(subB);
		}
		// Inner segment didnt return, which shouldnt happen.
		// But just in case, use a text comparison
		return pathA[i].localeCompare(pathB[i]);
	}
	// If the code actually gets here something went very wrong.
	// But, Same as last time, use a text comparison
	return pathA.join("/").localeCompare(pathB.join("/"));
});

// Base/Version/Chapter/image -> Version/Chapter/image
allFiles = allFiles.map((value)=>value.substring(BasePath.length + 1));

// Function from https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
function onlyUnique(value: string, index: number, array: string[]) {
	return array.indexOf(value) === index;
}

// Get all versions from the filepaths.
// Split on /, take the first element (or if null, empty string)
// Filter out empty string, then filter out duplicates
const versionList: string[] = allFiles
.map((v)=>v.split("/").shift() ?? "")
.filter((v)=>v!="")
.filter(onlyUnique);
// For all versions, Add it to the versions list
versionList.forEach((v)=>{
	versions[v]=[];
});

// For all files, add it to the correct version element
allFiles.forEach((file) => {
	const filename = file.substring(file.indexOf("/"));
	const folder = file.split("/").shift();
	if (folder) {
		versions[folder].push(filename);
	}
})

// Interfaces for json reading/writing
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
	title: string;
	description: string;
	artist: string;
	author: string;
	chapters: Record<string, string>;
}

// :(
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