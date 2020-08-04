# Data Models

Detailed below are the attributes defined in the Agricultural Data Model used in the NGSI-LD tutorial.

## Building

A Building is a human build structure where different activities occur related to living, working, healing and so on.
Defined in **Smart-Data-Models**

**Swagger** :
[Building](https://petstore.swagger.io/?url=https://smart-data-models.github.io/dataModel.Building/Building/swagger.yaml)

-   `address`: The mailing address. - <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **Property**. [address](https://schema.org/address)
    -   Normative References: `https://schema.org/address`
-   `category`: The categories that this building belongs to - <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **EnumProperty**.
-   `containedInPlace`: The URL this building resides within
    -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
-   `dataProvider`: Specifies the URL to information about the provider of this information
    -   Attribute type: **Property**. [URL](https://schema.org/URL)
-   `description`: A description of the item
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
    -   Normative References: `http://purl.org/dc/elements/1.1/description`
-   `floorsAboveGround`: Number of floors above ground within the building
    -   Attribute type: **Property**. [Integer](https://schema.org/Integer)
-   `floorsBelowGround`: Number of floors below ground within the building
    -   Attribute type: **Property**. [Integer](https://schema.org/Integer)
-   `location`: The current location of the item
    -   Attribute type: **GeoProperty**. [Point](https://purl.org/geojson/vocab#Point) or
        [LineString](https://purl.org/geojson/vocab#LineString) or [Polygon](https://purl.org/geojson/vocab#Polygon) or
        [MultiPoint](https://purl.org/geojson/vocab#MultiPoint) or
        [MultiLineString](https://purl.org/geojson/vocab#MultiLineString) or
        [MultiPolygon](https://purl.org/geojson/vocab#MultiPolygon)
    -   Normative References: `http://geojson.org/geojson-spec.html#geometry-objects`
-   `occupier`: Link to the occupiers of the building
    -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
-   `openingHours`:
    -   Attribute type: **Property**. [openingHours](https://schema.org/openingHours)
    -   Normative References: `https://schema.org/openingHours`
-   `owner`: The owner of this building
    -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
-   `refMap`: The URL holding a map of the building
    -   Attribute type: **Property**. [URL](https://schema.org/URL)
-   `source`: A sequence of characters giving the source of the entity data.
    -   Attribute type: **Property**. [Text](https://schema.org/Text) or [URL](https://schema.org/URL)
-   `temperature`: Property related to some measurements that are characterized by a certain value that is measured in a
    temperature unit (degree_Celsius, degree_Fahrenheit, or degree_kelvin)
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
    -   Meta Data:
        -   `providedBy`: The device that sent this reading
            -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
        -   `observedAt`: A timestamp which denotes when the reading was taken
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
        -   `unitCode`: A string representing the measurement unit corresponding to the Property value. It shall be
            encoded using the UN/CEFACT Common Codes for Units of Measurement
            -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `fillingLevel`: Property related to some measurements that are characterized by a certain value that is a filling
    level.
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
    -   Meta Data:
        -   `providedBy`: The device that sent this reading
            -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
        -   `observedAt`: A timestamp which denotes when the reading was taken
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
        -   `unitCode`: A string representing the measurement unit corresponding to the Property value. It shall be
            encoded using the UN/CEFACT Common Codes for Units of Measurement
            -   Attribute type: **Property**. [Text](https://schema.org/Text)

## TemperatureSensor

A device that consists of a sensor, has category `saref:Sensor` and is used for the purpose of sensing temperature`. .
Extension of _Device_ from **Smart-Data-Models**

**Swagger** :
[Device](https://petstore.swagger.io/?url=https://smart-data-models.github.io/dataModel.Device/Device/swagger.yaml)

-   `batteryLevel`: Device's battery level. It must be equal to `1.0` when battery is full. `0.0` when battery ìs empty.
    `-1` when transiently cannot be determined.
-   Allowed values: Interval \[0,1\] and -1
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
-   `category`: See attribute `category` from **DeviceModel**). -
    <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **EnumProperty**.
-   `configuration`: Device's technical configuration. This attribute is intended to be a dictionary of properties which
    capture parameters which have to do with the configuration of a device (timeouts, reporting periods, etc.) and which
    are not currently covered by the standard attributes defined by this model.
    -   Attribute type: **Property**. [StructuredValue](https://schema.org/StructuredValue)
    -   Meta Data:
        -   `dateModified`: Last update timestamp of this attribute
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `controlledAsset`: The asset(s) (building, object, etc.) controlled by the device.
    -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
-   `controlledProperty`: See attribute `controlledProperty` from **DeviceModel**). Optional but recommended to optimize
    queries.
    -   Attribute type: **EnumProperty**.
-   `dataProvider`: Specifies the URL to information about the provider of this information
    -   Attribute type: **Property**. [URL](https://schema.org/URL)
-   `dateFirstUsed`: A timestamp which denotes when the device was first used.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateInstalled`: A timestamp which denotes when the device was installed
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateLastCalibration`: A timestamp which denotes when the last calibration of the device happened.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateLastValueReported`: A timestamp which denotes the last time when the device successfully reported data to the
    cloud.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateManufactured`: A timestamp which denotes when the device was manufactured.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `description`: A description of the item
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
    -   Normative References: `http://purl.org/dc/elements/1.1/description`
-   `deviceState`: State of this device from an operational point of view. Its value can be vendor dependent.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `firmwareVersion`: The firmware version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `hardwareVersion`: The hardware version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `ipAddress`: The IP address of the device. It can be a comma separated list of values if the device has more than
    one IP address.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `location`: The current location of the item
    -   Attribute type: **GeoProperty**. [Point](https://purl.org/geojson/vocab#Point) or
        [LineString](https://purl.org/geojson/vocab#LineString) or [Polygon](https://purl.org/geojson/vocab#Polygon) or
        [MultiPoint](https://purl.org/geojson/vocab#MultiPoint) or
        [MultiLineString](https://purl.org/geojson/vocab#MultiLineString) or
        [MultiPolygon](https://purl.org/geojson/vocab#MultiPolygon)
    -   Normative References: `http://geojson.org/geojson-spec.html#geometry-objects`
-   `macAddress`: The MAC address of the device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `mcc`: Mobile Country Code - This property identifies univoquely the country of the mobile network the device is
    attached to.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `mnc`: This property identifies the Mobile Network Code (MNC) of the network the device is attached to. The MNC is
    used in combination with a Mobile Country Code (MCC) (also known as a "MCC / MNC tuple") to uniquely identify a
    mobile phone operator/carrier using the GSM, CDMA, iDEN, TETRA and 3G / 4G public land mobile networks and some
    satellite mobile
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `name`: A mnemonic name given to the device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `osVersion`: The version of the host operating system device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `owner`: The owners of a Device.
    -   Attribute type: **Relationship**. [Person](http://schema.org/Person) or
        [Organization](https://schema.org/Organization)
-   `provider`: The provider of the device.
    -   Attribute type: **Property**. [provider](https://schema.org/provider)
-   `refDeviceModel`: The device's model.
    -   Attribute type: **Relationship**. [DeviceModel](https://uri.fiware.org/ns/data-models#DeviceModel)
-   `rssi`: Received signal strength indicator for a wireless enabled device. It must be equal to `1.0` when the signal
    strength is maximum. `0.0` when signal is missing. `-1.0` when it cannot be determined.
-   Allowed values: Interval \[0,1\] and -1
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
-   `serialNumber`: The serial number assigned by the manufacturer. see
    [https://schema.org/serialNumber](https://schema.org/serialNumber)
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `softwareVersion`: The software version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `source`: A sequence of characters giving the source of the entity data.
    -   Attribute type: **Property**. [Text](https://schema.org/Text) or [URL](https://schema.org/URL)
-   `supportedProtocol`: See attribute `supportedProtocol` from **DeviceModel**). Needed if due to a software update new
    protocols are supported. Otherwise it is better to convey it at `DeviceModel` level.
    -   Attribute type: **EnumProperty**.
-   `value`: A observed or reported value. For actuator devices, it is an attribute that allows a controlling
    application to change the actuation setting. For instance, a switch device which is currently _on_ can report a
    value `"on"`of type `Text`. Obviously, in order to toggle the referred switch, this attribute value will have to be
    changed to `"off"`.
    -   Attribute type: **Property**. [Text](https://schema.org/Text) or
        [QuantitativeValue](https://schema.org/QuantitativeValue)
-   `temperature`: Property related to some measurements that are characterized by a certain value that is measured in a
    temperature unit (degree_Celsius, degree_Fahrenheit, or degree_kelvin) -
    <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
    -   Meta Data:
        -   `providedBy`: The device that sent this reading
            -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
        -   `observedAt`: A timestamp which denotes when the reading was taken
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
        -   `unitCode`: A string representing the measurement unit corresponding to the Property value. It shall be
            encoded using the UN/CEFACT Common Codes for Units of Measurement
            -   Attribute type: **Property**. [Text](https://schema.org/Text)

## FillingLevelSensor

A device that consists of a sensor, has category `saref:Sensor` and is used for the purpose of sensing filling Level.
Extension of _Device_ from **Smart-Data-Models**

**Swagger** :
[Device](https://petstore.swagger.io/?url=https://smart-data-models.github.io/dataModel.Device/Device/swagger.yaml)

-   `batteryLevel`: Device's battery level. It must be equal to `1.0` when battery is full. `0.0` when battery ìs empty.
    `-1` when transiently cannot be determined.
-   Allowed values: Interval \[0,1\] and -1
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
-   `category`: See attribute `category` from **DeviceModel**). -
    <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **EnumProperty**.
-   `configuration`: Device's technical configuration. This attribute is intended to be a dictionary of properties which
    capture parameters which have to do with the configuration of a device (timeouts, reporting periods, etc.) and which
    are not currently covered by the standard attributes defined by this model.
    -   Attribute type: **Property**. [StructuredValue](https://schema.org/StructuredValue)
    -   Meta Data:
        -   `dateModified`: Last update timestamp of this attribute
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `controlledAsset`: The asset(s) (building, object, etc.) controlled by the device.
    -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
-   `controlledProperty`: See attribute `controlledProperty` from **DeviceModel**). Optional but recommended to optimize
    queries.
    -   Attribute type: **EnumProperty**.
-   `dataProvider`: Specifies the URL to information about the provider of this information
    -   Attribute type: **Property**. [URL](https://schema.org/URL)
-   `dateFirstUsed`: A timestamp which denotes when the device was first used.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateInstalled`: A timestamp which denotes when the device was installed
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateLastCalibration`: A timestamp which denotes when the last calibration of the device happened.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateLastValueReported`: A timestamp which denotes the last time when the device successfully reported data to the
    cloud.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `dateManufactured`: A timestamp which denotes when the device was manufactured.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
-   `description`: A description of the item
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
    -   Normative References: `http://purl.org/dc/elements/1.1/description`
-   `deviceState`: State of this device from an operational point of view. Its value can be vendor dependent.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `firmwareVersion`: The firmware version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `hardwareVersion`: The hardware version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `ipAddress`: The IP address of the device. It can be a comma separated list of values if the device has more than
    one IP address.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `location`: The current location of the item
    -   Attribute type: **GeoProperty**. [Point](https://purl.org/geojson/vocab#Point) or
        [LineString](https://purl.org/geojson/vocab#LineString) or [Polygon](https://purl.org/geojson/vocab#Polygon) or
        [MultiPoint](https://purl.org/geojson/vocab#MultiPoint) or
        [MultiLineString](https://purl.org/geojson/vocab#MultiLineString) or
        [MultiPolygon](https://purl.org/geojson/vocab#MultiPolygon)
    -   Normative References: `http://geojson.org/geojson-spec.html#geometry-objects`
-   `macAddress`: The MAC address of the device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `mcc`: Mobile Country Code - This property identifies univoquely the country of the mobile network the device is
    attached to.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `mnc`: This property identifies the Mobile Network Code (MNC) of the network the device is attached to. The MNC is
    used in combination with a Mobile Country Code (MCC) (also known as a "MCC / MNC tuple") to uniquely identify a
    mobile phone operator/carrier using the GSM, CDMA, iDEN, TETRA and 3G / 4G public land mobile networks and some
    satellite mobile
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `name`: A mnemonic name given to the device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `osVersion`: The version of the host operating system device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `owner`: The owners of a Device.
    -   Attribute type: **Relationship**. [Person](http://schema.org/Person) or
        [Organization](https://schema.org/Organization)
-   `provider`: The provider of the device.
    -   Attribute type: **Property**. [provider](https://schema.org/provider)
-   `refDeviceModel`: The device's model.
    -   Attribute type: **Relationship**. [DeviceModel](https://uri.fiware.org/ns/data-models#DeviceModel)
-   `rssi`: Received signal strength indicator for a wireless enabled device. It must be equal to `1.0` when the signal
    strength is maximum. `0.0` when signal is missing. `-1.0` when it cannot be determined.
-   Allowed values: Interval \[0,1\] and -1
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
-   `serialNumber`: The serial number assigned by the manufacturer. see
    [https://schema.org/serialNumber](https://schema.org/serialNumber)
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `softwareVersion`: The software version of this device.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `source`: A sequence of characters giving the source of the entity data.
    -   Attribute type: **Property**. [Text](https://schema.org/Text) or [URL](https://schema.org/URL)
-   `supportedProtocol`: See attribute `supportedProtocol` from **DeviceModel**). Needed if due to a software update new
    protocols are supported. Otherwise it is better to convey it at `DeviceModel` level.
    -   Attribute type: **EnumProperty**.
-   `value`: A observed or reported value. For actuator devices, it is an attribute that allows a controlling
    application to change the actuation setting. For instance, a switch device which is currently _on_ can report a
    value `"on"`of type `Text`. Obviously, in order to toggle the referred switch, this attribute value will have to be
    changed to `"off"`.
    -   Attribute type: **Property**. [Text](https://schema.org/Text) or
        [QuantitativeValue](https://schema.org/QuantitativeValue)
-   `fillingLevel`: Property related to some measurements that are characterized by a certain value that is a filling
    level.
    -   Attribute type: **Property**. [Number](https://schema.org/Number)
    -   Meta Data:
        -   `providedBy`: The device that sent this reading
            -   Attribute type: **Relationship**. [URL](https://schema.org/URL)
        -   `observedAt`: A timestamp which denotes when the reading was taken
            -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
        -   `unitCode`: A string representing the measurement unit corresponding to the Property value. It shall be
            encoded using the UN/CEFACT Common Codes for Units of Measurement
            -   Attribute type: **Property**. [Text](https://schema.org/Text)

## Person

A person (alive, dead, undead, or fictional). Subset of _Person_ from `schema.org`

-   `dateCreated`: Entity's creation timestamp.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
    -   Read-Only. Automatically generated.
-   `dateModified`: Update timestamp of this entity.
    -   Attribute type: **Property**. [DateTime](https://schema.org/DateTime)
    -   Read-Only. Automatically generated.
-   `id`: URN holding the id of the attribute - <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **Property**.
-   `type`: The entity type - <span style="color:red;font-weight:bold">Required</span>
    -   Attribute type: **Property**.
-   `additionalName`: An additional name for a Person, can be used for a middle name.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `address`: The mailing address.
    -   Attribute type: **Property**. [address](https://schema.org/address)
    -   Normative References: `https://schema.org/address`
-   `email`: Email address.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `familyName`: Family name. In the U.S., the last name of an Person. This can be used along with givenName instead of
    the name property.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `faxNumber`: The fax number.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `gender`: Gender of something, typically a Person, but possibly also fictional characters, animals, etc. While
    `http://schema.org/Male` and `http://schema.org/Female` may be used, text strings are also acceptable for people who
    do not identify as a binary gender. The gender property can also be used in an extended sense to cover e.g. the
    gender of sports teams. As with the gender of individuals, we do not try to enumerate all possibilities. A
    mixed-gender SportsTeam can be indicated with a text value of "Mixed".. One of : `female`, `male`.
    -   Attribute type: **EnumProperty**. [GenderType](https://schema.org/GenderType)
-   `givenName`: Given name. In the U.S., the first name of a Person. This can be used along with familyName instead of
    the name property.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `honorificPrefix`: An honorific prefix preceding a Person's name such as Dr/Mrs/Mr.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `honorificSuffix`: An honorific suffix preceding a Person's name such as M.D. /PhD/MSCSW. interactionStatistic
    InteractionCounter The number of interactions for the CreativeWork using the WebSite or SoftwareApplication. The
    most specific child type of InteractionCounter should be used. Supersedes interactionCount.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `isicV4`: The International Standard of Industrial Classification of All Economic Activities (ISIC), Revision 4 code
    for a particular organization, business person, or place.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `jobTitle`: The job title of the person (for example, Financial Manager).
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `name`: The name of the item
    -   Attribute type: **Property**.
-   `taxID`: The Tax / Fiscal ID of the organization or person, e.g. the TIN in the US or the CIF/NIF in Spain.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `telephone`: The telephone number.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
-   `vatID`: The Value-added Tax ID of the organization or person.
    -   Attribute type: **Property**. [Text](https://schema.org/Text)
