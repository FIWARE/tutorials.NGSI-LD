declare module 'xml-parser' {
    interface XmlNode {
        name: string;
        attributes: Record<string, string>;
        children: XmlNode[];
        content: string;
    }

    interface XmlDocument {
        declaration?: { attributes: Record<string, string> };
        root: XmlNode;
    }

    function xmlParser(xmlString: string): XmlDocument;

    export = xmlParser;
}
