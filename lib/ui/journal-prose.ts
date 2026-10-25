// Presentation only: retain every source character, including punctuation and whitespace.
export function journalParagraphs(text:string):string[]{
  const parts:string[]=[];
  let cursor=0;
  for(const match of text.matchAll(/[。；][”’」』】）]*/g)){
    const end=match.index+match[0].length;
    parts.push(text.slice(cursor,end));
    cursor=end;
  }
  if(cursor<text.length)parts.push(text.slice(cursor));
  return parts;
}
