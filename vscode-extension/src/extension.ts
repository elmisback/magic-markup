import { commands, ExtensionContext } from "vscode";
import { AnnotationManagerPanel } from "./panels/AnnotationManagerPanel";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as vscode from "vscode";
import fs from "fs";
import path from "path";
import * as esbuild from "esbuild";
import * as chokidar from "chokidar";

// import retagUpdate from "./server/retag";
import { SidebarProvider } from "./panels/AnnotationManagerPanel";
import { AnnotationTracker } from "./AnnotationTracker";

// Helper to run REST endpoints
const runEndpointDictWithErrorHandlingOnPort = (
  port: number,
  endpointDict: { [key: string]: (req: any, res: any) => void },
  serverName: string
) => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  Object.entries(endpointDict).forEach(([endpoint, handler]) => {
    app.post(endpoint, async (req: any, res: any) => {
      console.log(endpoint, req.body);
      try {
        await handler(req, res);
      } catch (e) {
        vscode.window
          .showErrorMessage(`Error running ${endpoint}: ${e}`, "Copy to clipboard")
          .then((action) => {
            if (action === "Copy to clipboard") {
              vscode.env.clipboard.writeText((e as Error).cause?.toString() || (e as Error).stack || (e as Error).message);
            }
          });
        console.error(e);
      }
    });
  });
  return app.listen(port, () => {
    console.log(`${serverName} is running on port ${port}`);
  });
};

// Global annotation tracker instance
export let annotationTracker: AnnotationTracker;

// Track discovered user components
export let userComponents: { [key: string]: { name: string; path: string }} = {};

// Function to discover user components
async function discoverUserComponents(): Promise<{ [key: string]: { name: string; path: string } }> {
  const components: { [key: string]: { name: string; path: string } } = {};
  
  // Get workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.warn("No workspace folders found");
    return components;
  }
  
  const workspacePath = workspaceFolders[0].uri.fsPath;
  const componentsDir = path.join(workspacePath, 'codetations_components');
  const outDir = path.join(componentsDir, 'out');
  
  console.log(`Looking for components in: ${componentsDir}`);
  console.log(`Output directory: ${outDir}`);
  
  // Check if the components directory exists
  if (!fs.existsSync(componentsDir)) {
    console.warn(`Components directory does not exist: ${componentsDir}`);
    return components;
  }
  
  // Check if the output directory exists
  if (!fs.existsSync(outDir)) {
    console.warn(`Output directory does not exist: ${outDir}`);
    return components;
  }
  
  try {
    // First, look for compiled JS files in the output directory
    const compiledFiles = fs.readdirSync(outDir).filter(file => {
      return file.endsWith('.js') && !file.startsWith('.');
    });
    
    console.log(`Found ${compiledFiles.length} compiled files:`, compiledFiles);
    
    // Now look for source files to extract component names
    const sourceFiles = fs.readdirSync(componentsDir).filter(file => {
      const filePath = path.join(componentsDir, file);
      const stats = fs.statSync(filePath);
      return stats.isFile() && (file.endsWith('.tsx') || file.endsWith('.jsx')) && !file.startsWith('.');
    });
    
    console.log(`Found ${sourceFiles.length} source files:`, sourceFiles);
    
    // Process each source file
    for (const file of sourceFiles) {
      // Check if we have a corresponding compiled file
      const baseName = path.basename(file, path.extname(file));
      const compiledFile = compiledFiles.find(f => f.startsWith(baseName));
      
      if (!compiledFile) {
        console.warn(`No compiled file found for source: ${file}`);
        continue;
      }
      
      const filePath = path.join(componentsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Parse the file to extract the component name
      const componentNameMatch = fileContent.match(/export\s+default\s+(?:function\s+)?([A-Za-z0-9_]+)/);
      const componentName = componentNameMatch ? componentNameMatch[1] : baseName;
      
      // Create the component entry
      const key = baseName.toLowerCase();
      const compiledPath = path.join(outDir, compiledFile);
      
      // Create URI for the compiled file - this is what the webview will load
      // STORE THE RAW PATH INSTEAD OF THE URI STRING
      // const compiledUri = vscode.Uri.file(compiledPath).toString();
      
      console.log(`Adding component: ${key} = ${componentName} at ${compiledPath}`);
      
      components[key] = {
        name: componentName,
        // Use the raw path
        path: compiledPath 
      };
    }
    
    console.log(`Discovered ${Object.keys(components).length} components:`, components);
  } catch (error) {
    console.error(`Error discovering components: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return components;
}

// Function to compile user components with esbuild
async function compileUserComponents(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder found.');
    return;
  }
  
  const workspacePath = workspaceFolders[0].uri.fsPath;
  const componentsDir = path.join(workspacePath, 'codetations_components');
  const outDir = path.join(componentsDir, 'out');
  
  console.log(`Compiling components from: ${componentsDir}`);
  console.log(`Output directory: ${outDir}`);
  
  // Check if the components directory exists
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
    vscode.window.showInformationMessage(`Created codetations_components directory at ${componentsDir}.`);
    return;
  }
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`Created output directory: ${outDir}`);
  }
  
  // Find all component files
  const files = fs.readdirSync(componentsDir).filter(file => {
    const filePath = path.join(componentsDir, file);
    const stats = fs.statSync(filePath);
    return stats.isFile() && (file.endsWith('.tsx') || file.endsWith('.jsx')) && !file.startsWith('.');
  });
  
  if (files.length === 0) {
    vscode.window.showInformationMessage('No component files found in codetations_components directory.');
    return;
  }
  
  console.log(`Found ${files.length} component files to compile:`, files);
  
  // Prepare entry points for esbuild
  const entryPoints = files.map(file => path.join(componentsDir, file));
  
  try {
    // Run esbuild
    console.log(`Starting esbuild with entry points:`, entryPoints);
    
    const result = await esbuild.build({
      entryPoints,
      bundle: true,
      outdir: outDir,
      format: 'esm',
      target: 'es2020',
      // Bundle react and react-dom into the components to fix resolution error
      external: [],
      loader: {
        '.tsx': 'tsx',
        '.jsx': 'jsx',
      },
      // Write metadata to help with debugging
      metafile: true,
    });
    
    // Log build results if available
    if (result.metafile) {
      console.log("Build metadata:", result.metafile);
    }
    
    vscode.window.showInformationMessage(`Compiled ${files.length} custom components successfully!`);
    
    // Discover components after compilation
    console.log("Discovering compiled components...");
    userComponents = await discoverUserComponents();
    
    // Notify all webviews to reload components
    if (AnnotationManagerPanel.currentPanel) {
      console.log("Sending refreshComponents to panel");
      AnnotationManagerPanel.currentPanel.refreshComponents(userComponents);
    }
    
    // The sidebar view provider is not directly accessible through a global API
    // A better approach is to use a reference stored at activation time
    // For now we'll just rely on the panel notification
  } catch (error) {
    console.error("Build error:", error);
    vscode.window.showErrorMessage(`Failed to compile components: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Initialize the annotation tracker
  annotationTracker = new AnnotationTracker(context);
  context.subscriptions.push(annotationTracker);

  // First, discover user components so they're available immediately
  discoverUserComponents().then(components => {
    userComponents = components;
    
    // Now register the sidebar provider with access to the components
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider
      )
    );
    
    // Setup file watcher for components directory
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath;
      const componentsDir = path.join(workspacePath, 'codetations_components');
      
      if (fs.existsSync(componentsDir)) {
        const watcher = chokidar.watch(path.join(componentsDir, '*.{jsx,tsx}'), {
          persistent: true,
          ignoreInitial: true
        });
        
        // When files change, update the components list
        watcher.on('add', async () => {
          userComponents = await discoverUserComponents();
          // We don't auto-compile here, just update the list of available components
        }).on('change', async () => {
          userComponents = await discoverUserComponents();
        }).on('unlink', async () => {
          userComponents = await discoverUserComponents();
        });
        
        context.subscriptions.push({
          dispose: () => watcher.close()
        });
      }
    }
  });

  // Create the show annotations command
  const showAnnotationsCommand = commands.registerCommand("codetations.showAnnotations", () => {
    AnnotationManagerPanel.render(context.extensionUri);
    // After rendering, send the user components using the panel's method
    if (AnnotationManagerPanel.currentPanel) {
      AnnotationManagerPanel.currentPanel.refreshComponents(userComponents);
    }
  });

  const chooseAnnotationType = () => {
    AnnotationManagerPanel.render(context.extensionUri);
    const editor = vscode.window.activeTextEditor;
    AnnotationManagerPanel.currentPanel?.sendMessageObject({
      command: "chooseAnnotationType",
      data: {
        start: editor?.document.offsetAt(editor.selection.start),
        end: editor?.document.offsetAt(editor.selection.end),
        documentContent: editor?.document.getText(),
      },
    });
    // After rendering, send the user components using the panel's method
    if (AnnotationManagerPanel.currentPanel) {
      AnnotationManagerPanel.currentPanel.refreshComponents(userComponents);
    }
  };

  // Create a command for adding annotations
  const addAnnotationsCommand = commands.registerCommand("codetations.addAnnotation", () => {
    if (AnnotationManagerPanel.currentPanel) {
      AnnotationManagerPanel.currentPanel.addAnnotation();
    } else {
      chooseAnnotationType();
    }
  });

  // Command for removing annotations
  const removeAnnotationsCommand = commands.registerCommand("codetations.removeAnnotation", () => {
    AnnotationManagerPanel.currentPanel?.removeAnnotation();
  });

  // Command for setting annotation color
  const setAnnotationColorCommand = commands.registerCommand("codetations.setAnnotationColor", () => {
    AnnotationManagerPanel.currentPanel?.setAnnotationColor();
  });

  // Command for moving selected annotation
  const moveSelectedCommand = commands.registerCommand("codetations.moveSelected", () => {
    AnnotationManagerPanel.currentPanel?.moveSelectedAnnotation();
  });
  
  // Command for compiling user components - now just does compilation
  const compileUserComponentsCommand = commands.registerCommand("codetations.compileUserComponents", async () => {
    await compileUserComponents();
    // After compilation, force update the components list
    userComponents = await discoverUserComponents();
    // Send to any open panels using the panel's method
    if (AnnotationManagerPanel.currentPanel) {
      AnnotationManagerPanel.currentPanel.refreshComponents(userComponents);
    }
  });

  context.subscriptions.push(
    showAnnotationsCommand,
    addAnnotationsCommand,
    removeAnnotationsCommand,
    setAnnotationColorCommand,
    moveSelectedCommand,
    compileUserComponentsCommand
  );
}