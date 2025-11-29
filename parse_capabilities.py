import xml.etree.ElementTree as ET

try:
    tree = ET.parse('capabilities.xml')
    root = tree.getroot()
    
    # Namespaces
    ns = {
        'wmts': 'http://www.opengis.net/wmts/1.0',
        'ows': 'http://www.opengis.net/ows/1.1'
    }
    
    print("Available Layers:")
    for layer in root.findall('.//wmts:Layer', ns):
        identifier = layer.find('ows:Identifier', ns)
        if identifier is not None:
            print(f"- {identifier.text}")
                
except Exception as e:
    print(f"Error: {e}")
