import JSZip from 'jszip'
import { useDocumentStore } from '../stores/document'
import type { DocumentMeta } from '../types'

export async function exportToZip(): Promise<void> {
  const documentStore = useDocumentStore()
  const { metas, contents, images } = await documentStore.exportAllData()
  
  const zip = new JSZip()
  
  for (const meta of metas) {
    const content = contents.get(meta.id) || ''
    const filename = meta.path === '/' 
      ? `${meta.title}.md` 
      : `${meta.path.replace(/^\//, '')}/${meta.title}.md`
    zip.file(filename, content)
  }
  
  const metadata: DocumentMeta[] = metas.map(meta => ({
    ...meta,
    updatedAt: meta.updatedAt,
    createdAt: meta.createdAt
  }))
  
  zip.file('_metadata.json', JSON.stringify(metadata, null, 2))
  
  const imagesFolder = zip.folder('_images')
  if (imagesFolder) {
    for (const [id, blob] of images) {
      imagesFolder.file(id, blob)
    }
  }
  
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  
  URL.revokeObjectURL(url)
}

export async function importFromZip(): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.zip'
  
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => {
      resolve(input.files?.[0] || null)
    }
    input.click()
  })
  
  if (!file) return
  
  const zip = await JSZip.loadAsync(file)
  const metadataFile = zip.file('_metadata.json')
  
  if (!metadataFile) {
    alert('无效的知识库 ZIP 文件')
    return
  }
  
  const metadataRaw = await metadataFile.async('string')
  const metas: DocumentMeta[] = JSON.parse(metadataRaw)
  const contents = new Map<string, string>()
  
  for (const meta of metas) {
    const filename = meta.path === '/' 
      ? `${meta.title}.md` 
      : `${meta.path.replace(/^\//, '')}/${meta.title}.md`
    const docFile = zip.file(filename)
    
    if (docFile) {
      const content = await docFile.async('string')
      contents.set(meta.id, content)
    }
  }
  
  const imagesFolder = zip.folder('_images')
  if (imagesFolder) {
    const { saveImage } = await import('./db')
    
    for (const [name, fileObj] of Object.entries(imagesFolder.files)) {
      if (!fileObj.dir) {
        const blob = await fileObj.async('blob')
        await saveImage(blob, name)
      }
    }
  }
  
  const documentStore = useDocumentStore()
  await documentStore.importDocuments(metas, contents)
  
  alert('导入成功！')
}
