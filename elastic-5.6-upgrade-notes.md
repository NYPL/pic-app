# Migration to ES 5.6

This documents steps taken to migrate PIC from elasticsearch 1.7 to 5.6.

## 1. Create index:

Create a new 5.6 deployment, and initialize index:

```
PUT https://[FQDN new index]:9243/pic/
```

## 2. Add accent analyzer:

1. Enable `cluster.indices.close.enable: true` via Console > pic-2019 > Edit > User Overrides

2. Close index:
  a. Enable `cluster.indices.close.enable: true` via Console > pic-2019 > Edit > User Overrides
  b. `POST https://[FQDN new index]:9243/pic/_close`

3. Put settings:
```
PUT https://[FQDN new index]:9243/pic/_settings
{
   "analysis" : {
      "analyzer" : {
         "accent_analyzer" : {
            "preserve_original" : "true",
            "type" : "custom",
            "filter" : [
               "lowercase",
               "asciifolding"
            ],
            "tokenizer" : "standard"
         }
      }
   }
}
```

3. Open index: 
  a. `POST https://[FQDN new index]:9243/pic/_open`
  b. TODO: should remove `cluster.indices.close.enable: true` in Console > pic-2019 > Edit > User Overrides

## 3. Create mappings:

First create address mapping (because it's a child).

```
PUT https://[FQDN new index]:9243/pic/_mapping/address
{
   "properties" : {
      "Country" : {
         "type" : "text"
      },
      "Location" : {
         "type" : "geo_point"
      },
      "AddressTypeID" : {
         "type" : "text",
         "fielddata": "true"
      },
      "Remarks" : {
         "type" : "text"
      },
      "ConAddressID" : {
         "type" : "text"
      },
      "CountryID" : {
         "type" : "text",
         "fielddata": "true"
      },
      "StreetLine2" : {
         "type" : "text"
      },
      "AddressType" : {
         "type" : "text"
      },
      "City" : {
         "type" : "text"
      },
      "ConstituentID" : {
         "type" : "text"
      },
      "id" : {
         "type" : "text"
      },
      "StreetLine1" : {
         "type" : "text"
      },
      "BeginDate" : {
         "type" : "integer"
      },
      "DisplayName2" : {
         "type" : "text"
      },
      "EndDate" : {
         "type" : "integer"
      },
      "StreetLine3" : {
         "type" : "text"
      },
      "State" : {
         "type" : "text"
      }
   },
   "_parent" : {
      "type" : "constituent"
   }
}
```

Next, create constituent mapping:

```
PUT https://[FQDN new index]:9243/pic/_mapping/constituent
{
  "properties": {
   "DisplayName" : {
      "analyzer" : "accent_analyzer",
      "type" : "text"
   },
   "Nationality" : {
      "type" : "text"
   },
   "ConstituentID" : {
      "type" : "text"
   },
   "AlphaSort" : {
      "fields" : {
         "raw" : {
            "type" : "keyword"
         }
      },
      "analyzer" : "accent_analyzer",
      "type" : "text"
   },
   "TextEntry" : {
      "type" : "text"
   },
   "DisplayDate" : {
      "type" : "text"
   },
   "addressTotal" : {
      "type" : "integer"
   },
   "gender" : {
      "properties" : {
         "Term" : {
            "type" : "text"
         },
         "TermID" : {
            "type" : "text",
            "fielddata": "true"
         }
      }
   },
   "BeginDate" : {
      "type" : "integer"
   },
   "collection" : {
      "properties" : {
         "URL" : {
            "type" : "text"
         },
         "Term" : {
            "type" : "text"
         },
         "TermID" : {
            "type" : "text",
            "fielddata": "true"
         }
      }
   },
   "biography" : {
      "properties" : {
         "TermID" : {
            "type" : "text",
            "fielddata": "true"
         },
         "Term" : {
            "type" : "text"
         },
         "URL" : {
            "type" : "text"
         }
      }
   },
   "id" : {
      "type" : "text"
   },
   "process" : {
      "properties" : {
         "TermID" : {
            "type" : "text"
         },
         "Term" : {
            "type" : "text",
            "fielddata": "true"
         }
      }
   },
   "EndDate" : {
      "type" : "integer"
   },
   "ConstituentTypeID" : {
      "type" : "text"
   },
   "format" : {
      "properties" : {
         "Term" : {
            "type" : "text"
         },
         "TermID" : {
            "type" : "text",
            "fielddata": "true"
         }
      }
   },
   "nameSort" : {
      "type" : "text"
   },
   "role" : {
      "properties" : {
         "TermID" : {
            "type" : "text",
            "fielddata": "true"
         },
         "Term" : {
            "type" : "text"
         }
      }
   }
  }
}
```

## 4. Disable (remove) `cluster.indices.close.enable: true` via Console > pic-2019 > Edit > User Overrides

## 5. Reindex data

Reindex data from old ES 1.7 index to new 5.6 index:

```
POST https://[FQDN new index]:9243/_reindex
{
  "source": {
    "remote": {
      "host": "https://[FQDN old index]:9243",
      "username": "readonly",
      "password": "[old index password]"
    },
    "index": "pic",
    "query": {
      "match_all": {
      }
    }
  },
  "dest": {
    "index": "pic"
  }
}
```

That took ~53s.

## 6. Apply code changes to adapt to 5.6 api
