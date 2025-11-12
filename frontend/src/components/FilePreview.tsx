import { useEffect } from "react"
import type { ReceivedFile } from "../App"

const FilePreview = ({file}: {file: ReceivedFile}) => {
    useEffect(() => {
        console.log(file)
    }, [file])
  return (
    <div>
        <div>{file.name}</div>
        <img src={file.url}/>
        <a href={file.url} download={file.url}>Download</a>
        <div>{file.size}</div>
    </div>
  )
}

export default FilePreview