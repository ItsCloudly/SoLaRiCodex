Title: [MusicBrainz API](/doc/MusicBrainz%5FAPI)

URL Source: https://musicbrainz.org/doc/MusicBrainz_API

Markdown Content:
[](/ "MusicBrainz")

* [Log in](/login?returnto=%2Fdoc%2FMusicBrainz%5FAPI)
* [Create account](/register?returnto=%2Fdoc%2FMusicBrainz%5FAPI)

ArtistEventRecordingReleaseRelease groupSeriesWorkAreaInstrumentLabelPlaceAnnotationTagCD stubEditorDocumentation 

* About us ▾  
   * [About MusicBrainz](/doc/About)  
   * [Sponsors](https://metabrainz.org/sponsors)  
   * [Team](https://metabrainz.org/team)  
   * [Shop](https://www.redbubble.com/people/metabrainz/shop)  
   * [Contact us](https://metabrainz.org/contact)  
   * [Data licenses](/doc/About/Data%5FLicense)  
   * [Social contract](https://metabrainz.org/social-contract)  
   * [Code of Conduct](/doc/Code%5Fof%5FConduct)  
   * [Privacy policy](https://metabrainz.org/privacy)  
   * [GDPR compliance](https://metabrainz.org/gdpr)  
   * [Copyright and DMCA compliance](/doc/Copyright%5Fand%5FDMCA%5FCompliance)  
   * [Data removal policy](/doc/Data%5FRemoval%5FPolicy)  
   * [Auto-editor elections](/elections)  
   * [Privileged user accounts](/privileged)  
   * [Statistics](/statistics)  
   * [Timeline graph](/statistics/timeline)  
   * [MusicBrainz history](/history)
* Products ▾  
   * [MusicBrainz Picard](//picard.musicbrainz.org)  
   * [AudioRanger](/doc/AudioRanger)  
   * [Mp3tag](/doc/Mp3tag)  
   * [Yate Music Tagger](/doc/Yate%5FMusic%5FTagger)  
   * [MusicBrainz for Android](/doc/MusicBrainz%5Ffor%5FAndroid)  
   * [MusicBrainz Server](/doc/MusicBrainz%5FServer)  
   * [MusicBrainz Database](/doc/MusicBrainz%5FDatabase)  
   * [Developer resources](/doc/Developer%5FResources)  
   * [MusicBrainz API](/doc/MusicBrainz%5FAPI)  
   * [Live Data Feed](/doc/Live%5FData%5FFeed)
* Search ▾  
   * [Advanced search](/search)  
   * [Edit search](/search/edits)  
   * [Tag cloud](/tags)  
   * [Top CD stubs](/cdstub/browse)
* Documentation ▾  
   * [Beginners guide](/doc/Beginners%5FGuide)  
   * [Style guidelines](/doc/Style)  
   * [How tos](/doc/How%5FTo)  
   * [FAQs](/doc/Frequently%5FAsked%5FQuestions)  
   * [Documentation index](/doc/MusicBrainz%5FDocumentation)  
   * [Edit types](/doc/Edit%5FTypes)  
   * [Relationship types](/relationships)  
   * [Instrument list](/instruments)  
   * [Genre list](/genres)  
   * [Development](/doc/Development)
* English ▾  
   * [Deutsch](/set-language/de?returnto=%2Fdoc%2FMusicBrainz%5FAPI)  
   * **[English](/set-language/en?returnto=%2Fdoc%2FMusicBrainz%5FAPI)**  
   * [Français](/set-language/fr?returnto=%2Fdoc%2FMusicBrainz%5FAPI)  
   * [Italiano](/set-language/it?returnto=%2Fdoc%2FMusicBrainz%5FAPI)  
   * [Nederlands](/set-language/nl?returnto=%2Fdoc%2FMusicBrainz%5FAPI)  
   * [(reset language)](/set-language/unset?returnto=%2Fdoc%2FMusicBrainz%5FAPI)  
   * [Help translate](https://translations.metabrainz.org/projects/musicbrainz/)

The browser you’re using is unsupported, and the website may not work correctly for you. It’s recommended that you upgrade to a recent version of Firefox, Safari, Edge, or any Chrome-based browser. If that’s not possible, you can try enabling [legacy browser mode](/toggle-legacy-browser?returnto=https%3A%2F%2Fmusicbrainz.org%2Fdoc%2FMusicBrainz%5FAPI).

Search

# [MusicBrainz API](/doc/MusicBrainz%5FAPI)

The API discussed here is an interface to the [MusicBrainz Database](/doc/MusicBrainz%5FDatabase). It is aimed at developers of media players, CD rippers, taggers, and other applications requiring music metadata. The API's architecture follows the REST design principles. Interaction with the API is done using HTTP and all content is served in a simple but flexible format, in either XML or JSON. XML is the default format; to get a JSON response, you can either set the Accept header to `"application/json"` or add `fmt=json` to the query string (if both are set, `fmt=` takes precedence). 

## Contents

* [1 General FAQ](#General%5FFAQ)
* [2 Application rate limiting and identification](#Application%5Frate%5Flimiting%5Fand%5Fidentification)
* [3 Authentication](#Authentication)
* [4 Introduction](#Introduction)  
   * [4.1 Relax NG Schema](#Relax%5FNG%5FSchema)
* [5 Search](#Search)
* [6 Lookups](#Lookups)  
   * [6.1 Subqueries](#Subqueries)  
   * [6.2 inc= arguments which affect subqueries](#inc=%5Farguments%5Fwhich%5Faffect%5Fsubqueries)  
   * [6.3 Misc inc= arguments](#Misc%5Finc=%5Farguments)  
   * [6.4 Relationships](#Relationships)
* [7 Non-MBID Lookups](#Non-MBID%5FLookups)  
   * [7.1 discid](#discid)  
   * [7.2 isrc](#isrc)  
   * [7.3 iswc](#iswc)
* [8 url (by text)](#url%5F%28by%5Ftext%29)
* [9 Browse](#Browse)  
   * [9.1 Linked entities](#Linked%5Fentities)  
   * [9.2 Paging](#Paging)  
   * [9.3 inc=](#inc=)
* [10 Release (Group) Type and Status](#Release%5F%28Group%29%5FType%5Fand%5FStatus)
* [11 Submitting data](#Submitting%5Fdata)  
   * [11.1 User data](#User%5Fdata)  
         * [11.1.1 tags](#tags)  
         * [11.1.2 ratings](#ratings)  
         * [11.1.3 collections](#collections)  
   * [11.2 Barcode submission](#Barcode%5Fsubmission)  
   * [11.3 ISRC submission](#ISRC%5Fsubmission)
* [12 Libraries](#Libraries)

## General FAQ

What can I do with the MusicBrainz API?You can look up information about a particular [MusicBrainz entity](/doc/MusicBrainz%5FEntity) ("give me info about The Beatles"), browse the data to find entities connected to a particular entity ("show me all releases by The Beatles"), or search for entities matching a specific query ("show me all artists matching the query 'Beatles' so I can find the one I want and ask for more data").Who can use the MusicBrainz API? Is it free?[Non-commercial](/doc/Live%5FData%5FFeed) use of this web service is free; please see [our commercial plans](https://metabrainz.org/supporters/account-type) or [contact us](/doc/Contact%5FUs) if you would like to use this service commercially.Do I need an API key?Currently, no. But you must have a meaningful [user-agent string](/doc/MusicBrainz%5FAPI/Rate%5FLimiting#Provide%5Fmeaningful%5FUser-Agent%5Fstrings).Do I need to provide authentication?See [MusicBrainz\_API#Authentication](#Authentication).Which formats can I get the data in?The API was originally written to return XML, but nowadays it can also return JSON.Is there any significant difference between the XML and JSON APIs?For requesting data, the XML and JSON API are effectively equivalent. The XML API is the only one that allows [submitting data](#Submitting%5Fdata) to MusicBrainz (but keep in mind only ratings, tags, barcodes and ISRCs can be submitted via the API at all; for most data additions you should use the website instead).Is there a limit to the number of requests I can make per second?**Yes**. See [our rate limiting rules](/doc/MusicBrainz%5FAPI/Rate%5FLimiting).This seems very complicated, can I see some examples?Yes, we have [an example page](/doc/MusicBrainz%5FAPI/Examples) showcasing some queries and showing the returned format you can expect for each.Are there language bindings for the API?Yes, in many different languages. See [our list of external libraries](#Libraries).What should I do if I encounter unexpected behaviour not covered in these docs?

You can ask question in [IRC](/doc/IRC) or in the [forums](https://community.metabrainz.org/).

Check to see if a ticket has been filed in the [bug tracker](https://tickets.metabrainz.org/issues/?jql=project%20%3D%20MBS%20AND%20component%20%3D%20%22Web%20service%22%20AND%20resolution%20%3D%20Unresolved%20ORDER%20BY%20priority%20DESC), and if not consider writing one.What else should I know before I start using the API?It'd probably be helpful to know: 
* [How MusicBrainz is structured](/doc/MusicBrainz%5FDatabase/Schema)
* What [relationships](https://musicbrainz.org/relationships/) are available
So you're on version 2 of the API then? What happened to version 1?The version 1 of the API was designed with the data structure of the original (pre-2011) version of the MusicBrainz database in mind. It was deprecated in 2011 when we changed to our current data schema, and after running (without further updates) for several years to avoid breaking any tools using it, it was finally taken down in 2019.Do you ever make breaking changes?We try to avoid that, but sometimes we might need to do so. In those cases, they will be announced on [our blog](https://blog.metabrainz.org/category/musicbrainz+breaking-changes/), so consider following that!

## Application rate limiting and identification

All users of the API must ensure that each of their client applications never make more than ONE call per second. Making more than one call per second drives up the load on the servers and prevents others from using the MusicBrainz API. If you impact the server by making more than one call per second, your IP address may be blocked preventing all further access to MusicBrainz. Also, it is important that your application sets a proper User-Agent string in its HTTP request headers. For more details on both of these requirements, please see our [rate limiting page](/doc/MusicBrainz%5FAPI/Rate%5FLimiting). 

## Authentication

Data submission, as well as requests that involve user information, require authentication. You can authenticate using [OAuth](/doc/Development/OAuth2), or [digest authentication](https://en.wikipedia.org/wiki/Digest%5Faccess%5Fauthentication) over HTTPS; for digest authentication, use the same username and password used to access the main <https://musicbrainz.org> website. 

## Introduction

The API root URL is `https://musicbrainz.org/ws/2/`. 

We have 13 resources on our API which represent core [entities](/doc/Entity) in our database: 

 area, artist, event, genre, instrument, label, place, recording, release, release-group, series, work, url

We also provide an API interface for the following non-core resources: 

 rating, tag, collection

And we allow you to perform lookups based on other unique identifiers with these resources: 

 discid, isrc, iswc

On each entity resource, you can perform three different GET requests: 

 lookup:   /<ENTITY_TYPE>/<MBID>?inc=<INC>
 browse:   /<RESULT_ENTITY_TYPE>?<BROWSING_ENTITY_TYPE>=<MBID>&limit=<LIMIT>&offset=<OFFSET>&inc=<INC>
 search:   /<ENTITY_TYPE>?query=<QUERY>&limit=<LIMIT>&offset=<OFFSET>

... except that browse and search are not implemented for genre entities at this time. 

 **Note:** Keep in mind only the search request is available without an [MBID](/doc/MusicBrainz%5FIdentifier) (or, in specific cases, a disc ID, ISRC or ISWC). If all you have is the name of an artist or album, for example, you'll need to make a search and pick the right result to get its MBID; only then will you able to use it in a lookup or browse request. 

On the genre resource, we support an "all" sub-resource to fetch all genres, paginated, in alphabetical order: 

 all:      /genre/all?limit=<LIMIT>&offset=<OFFSET>

The `/genre/all` resource, in addition to supporting XML and JSON, can output all genre _names_ as text by specifying `fmt=txt` or setting the Accept header to `"text/plain"`. The genre names are returned in alphabetical order and separated by newlines. (`limit` and `offset` are not supported for the `txt` format.) 

Of these first three types of requests: 
* Lookups, non-MBID lookups and browse requests are documented in following sections, and you can find examples on [the dedicated examples page](/doc/MusicBrainz%5FAPI/Examples).
* Searches are more complex and are documented on [the search documentation page](/doc/MusicBrainz%5FAPI/Search).

### Relax NG Schema

The file [musicbrainz\_mmd-2.0.rng](https://github.com/metabrainz/mmd-schema/blob/master/schema/musicbrainz%5Fmmd-2.0.rng) is a Relax NG Schema for the XML version of this API. It can also be used to validate [submissions](#Submitting%5Fdata) you're trying to make through it. 

## Search

Searches are documented on [the search documentation page](/doc/MusicBrainz%5FAPI/Search). 

## Lookups

You can perform a lookup of an entity when you have the MBID for that entity: 

 lookup:   /<ENTITY_TYPE>/<MBID>?inc=<INC>

Note that unless you have provided an MBID in exactly the format listed, you are not performing a lookup request. If your URL includes something like artist=<MBID>, then please see the [Browse](#Browse) section. If it includes query=<QUERY>, please see the [Search](/doc/MusicBrainz%5FAPI/Search) page. 

### Subqueries

The inc= parameter allows you to request more information to be included about the entity. Any of the entities directly linked to the entity can be included. 

 /ws/2/area
 /ws/2/artist            recordings, releases, release-groups, works
 /ws/2/collection        user-collections (includes private collections, requires authentication)
 /ws/2/event
 /ws/2/genre
 /ws/2/instrument
 /ws/2/label             releases
 /ws/2/place
 /ws/2/recording         releases, release-groups
 /ws/2/release           collections, labels, recordings, release-groups
 /ws/2/release-group     releases
 /ws/2/series
 /ws/2/work
 /ws/2/url

In addition, [Relationships](#Relationships) are available for all entity types except genres via inc parameters. 

To include more than one subquery in a single request, separate the arguments to `inc=` with a + (plus sign), like `inc=recordings+labels`. 

All lookups which include release-groups allow a type= argument to filter the release-groups by a specific type. All lookups which include releases also allow the type= argument, and a status= argument is allowed. 

Note that the number of linked entities returned is always limited to 25\. If you need the remaining results, you will have to perform a browse request. 

Linked entities are always ordered alphabetically by gid. 

 **Note:** In the XML API, when including `recordings` with a `release` entity, `tracks` listed in `media` have no `title` if that doesn’t differ from recording’s title, to reduce the size of the response. 

### inc= arguments which affect subqueries

Some additional inc= parameters are supported to specify how much of the data about the linked entities should be included: 

 - discids           include discids for all media in the releases
 - media             include media for all releases, this includes the # of tracks on each medium and its format.
 - isrcs             include isrcs for all recordings
 - artist-credits    include artists credits for all releases and recordings
 - various-artists   include only those releases where the artist appears on one of the tracks, 
                     but not in the artist credit for the release itself (this is only valid on a
                     /ws/2/artist?inc=releases request).

### Misc inc= arguments

 - aliases                   include artist, label, area or work aliases; treat these as a set, as they are not deliberately ordered
 - annotation                include annotation
 - tags, ratings             include tags and/or ratings for the entity
 - user-tags, user-ratings   same as above, but only return the tags and/or ratings submitted by the specified user
 - genres, user-genres       include genres (tags in [the genres list](https://musicbrainz.org/genres)): either all or the ones submitted by the user, respectively

Requests with user-tags, user-genres and user-ratings require [authentication](#Authentication). 

The method to request genres mirrors that of tags: you can use inc=genres to get all the genres everyone has proposed for the entity, or inc=user-genres to get all the genres you have proposed yourself (or both!). For example, to get the genres for the release group for [Nine Inch Nails' Year Zero](https://musicbrainz.org/release-group/3bd76d40-7f0e-36b7-9348-91a33afee20e) you’d want **https://musicbrainz.org/ws/2/release-group/3bd76d40-7f0e-36b7-9348-91a33afee20e?inc=genres+user-genres** for the XML API and **https://musicbrainz.org/ws/2/release-group/3bd76d40-7f0e-36b7-9348-91a33afee20e?inc=genres+user-genres&fmt=json** for the JSON API. 

Since genres are tags, all the genres are also served with inc=tags with all the other tags. As such, you can always use the tag endpoint if you would rather filter the tags by your own genre list rather than follow the MusicBrainz one, or if you want to also get other non-genre tags (maybe you want moods, or maybe you’re really interested in finding artists who perform hip hop music and [were murdered](https://musicbrainz.org/tag/death%20by%20murder) – we won’t stop you!). 

### Relationships

You can request relationships with the appropriate includes: 

 - area-rels
 - artist-rels
 - event-rels
 - genre-rels
 - instrument-rels
 - label-rels
 - place-rels
 - recording-rels
 - release-rels
 - release-group-rels
 - series-rels
 - url-rels
 - work-rels

These will load relationships between the requested entity and the specific entity type. For example, if you request "work-rels" when looking up an artist, you'll get all the relationships between this artist and any works, and if you request "artist-rels" you'll get the relationships between this artist and any other artists. As such, keep in mind requesting "artist-rels" for an artist, "release-rels" for a release, etc. **will not** load all the relationships for the entity, just the ones to _other entities of the same type_. 

In a release request, you might also be interested on relationships for _the recordings linked to the release_, or _the release group linked to the release_, or even for _the works linked to those recordings that are linked to the release_ (for example, to find out who played guitar on a specific track, who wrote the lyrics for the song being performed, or whether the release group is part of a series). Similarly, for a recording request, you might want to get the relationships for any linked works. There are three additional includes for this: 

 - recording-level-rels
 - release-group-level-rels (for releases only)
 - work-level-rels

Keep in mind these just act as switches. If you request _work-level-rels_ for a recording, you will still need to request _work-rels_ (to get the relationship from the recording to the work in the first place) and any other relationship types you want to see (for example, _artist-rels_ if you want to see work-artist relationships). 

With relationships included, entities will have `<relation-list>` nodes for each target entity type (XML) or a `relations` object containing all relationships (JSON). You can see some examples [the examples page](/doc/MusicBrainz%5FAPI/Examples). 

Any [attributes](https://musicbrainz.org/relationship-attributes) on a relationship will be on `<attribute-list>` nodes (XML) or in the `attributes` array (JSON). Relationship attributes always have a type ID, and some may have an associated value. Those can be found as attributes of the `<attribute>` element (XML) or by using the attribute name as a key for the `attribute-values` and `attribute-ids` elements (JSON). Sometimes the relationship attribute may also have a 'credited-as' name indicated by the user (for example, "guitar" could be credited as "Fender Stratocaster" or "violin" as "1st violin"). In an XML response this is yet another attribute on the XML `<attribute>` element element, while on a JSON response you'll need to look at the `attribute-credits` element. 

Note that requesting "genre-rels" does not indicate the genres for a specific entity. For that, use "genres". 

## Non-MBID Lookups

Instead of MBIDs, you can also perform lookups using several other unique identifiers. However, because clashes sometimes occur, each of these lookups return a list of entities (there is no limit, all linked entities will be returned, paging is not supported). 

### discid

 lookup: /discid/<discid>?inc=<INC>&toc=<TOC>

A `discid` lookup returns a list of associated releases, the 'inc=' arguments supported are identical to a lookup request for a release. 

If there are no matching releases in MusicBrainz, but a matching [CD stub](/doc/CD%5FStub) exists, it will be returned. This is the default behaviour. If you do _not_ want to see CD stubs, pass 'cdstubs=no.' CD stubs are contained within a <cdstub> element, and otherwise have the same form as a release. Note that CD stubs do not have artist credits, just artists. 

If you provide the "toc" query parameter, and if the provided disc ID is not known by MusicBrainz, a fuzzy lookup will done to find matching MusicBrainz releases. Note that if CD stubs are found this will not happen. If you do want TOC fuzzy lookup, but not CD stub searching, specify "cdstubs=no". For example: 

  /ws/2/discid/I5l9cCSFccLKFEKS.7wqSZAorPU-?toc=1+12+267257+150+22767+41887+58317+72102+91375+104652+115380+132165+143932+159870+174597

Will look for the disc id first, and if it fails, will try to find tracklists that are within a similar distance to the one provided. 

It's also possible to perform a fuzzy TOC search without a discid. Passing "-" (or any invalid placeholder) as the discid will cause it to be ignored if a valid TOC is present: 

  /ws/2/discid/-?toc=1+12+267257+150+22767+41887+58317+72102+91375+104652+115380+132165+143932+159870+174597

By default, fuzzy TOC searches only return mediums whose format is set to "CD." If you want to search all mediums regardless of format, add 'media-format=all' to the query: 

  /ws/2/discid/-?toc=1+12+267257+150+22767+41887+58317+72102+91375+104652+115380+132165+143932+159870+174597&media-format=all

The TOC consists of the following: 
* First track (always 1)
* total number of tracks
* sector offset of the leadout (end of the disc)
* a list of sector offsets for each track, beginning with track 1 (generally 150 sectors)

### isrc

 lookup: /isrc/<isrc>?inc=<INC>

An `isrc` lookup returns a list of recordings, the 'inc=' arguments supported are identical to a lookup request for a recording. 

### iswc

 lookup: /iswc/<iswc>?inc=<INC>

An `iswc` lookup returns a list of works, the 'inc=' arguments supported are identical to a lookup request for a work. 

## url (by text)

 lookup: /ws/2/url?resource=<URL>[&resource=<URL>]...

The URL endpoint's 'resource' parameter is for providing a URL directly, rather than a URL MBID (for example, <https://musicbrainz.org/ws/2/url?resource=http://www.madonna.com/> versus <https://musicbrainz.org/ws/2/url/b663423b-9b54-4067-9674-fffaecf68851>). This URL will need to be appropriately URL-escaped for inclusion as a query parameter; this means that URLs that include url-escaped parameters, or query parameters of their own, will need to be escaped a second time. 

If the requested 'resource' does not exist, this endpoint will return 404 not found. 

The 'resource' parameter can be specified multiple times (up to 100) in a single query: 

 /ws/2/url?resource=http://www.madonna.com/&resource=https://www.ladygaga.com/

The response will contain a url-list in this case, rather than a single top-level url, and any 'resource' that is not found will be skipped. 

## Browse

Browse requests are a direct lookup of all the entities directly linked to another entity ("directly linked" here meaning it does not include entities linked by a relationship). For example, you may want to see all releases on the label ubiktune: 

 /ws/2/release?label=47e718e1-7ee4-460c-b1cc-1192a841c6e5

Note that browse requests are not searches: in order to browse all the releases on the ubiktune label you will need to know the MBID of ubiktune. 

The order of the results depends on what linked entity you are browsing by (however it will always be consistent). If you need to sort the entities, you will have to fetch all entities (see "Paging" below) and sort them yourself. 

### Linked entities

The following list shows which linked entities you can use in a browse request: 

 /ws/2/area              collection
 /ws/2/artist            area, collection, recording, release, release-group, work
 /ws/2/collection        area, artist, editor, event, label, place, recording, release, release-group, work
 /ws/2/event             area, artist, collection, event, place
 /ws/2/genre             collection
 /ws/2/instrument        collection
 /ws/2/label             area, collection, release
 /ws/2/place             area, collection
 /ws/2/recording         artist, collection, release, work
 /ws/2/release           area, artist, collection, label, track, track_artist, recording, release-group
 /ws/2/release-group     artist, collection, release
 /ws/2/series            collection
 /ws/2/work              artist, collection

As a special case, release also allows track\_artist, which is intended to allow you to browse various artist appearances for an artist. It will return any release where the artist appears in the artist credit for a track, but NOT in the artist credit for the entire release (as those would already have been returned in a request with artist=<MBID>). 

Release-groups can be filtered on type, and releases can be filtered on type and/or status. For example, if you want all the live bootleg releases by Metallica: 

 /ws/2/release?artist=65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab&status=bootleg&type=live

Or all albums and EPs by Autechre: 

 /ws/2/release-group?artist=410c9baf-5469-44f6-9852-826524b80c61&type=album|ep

### Paging

Browse requests are the only requests which support paging: any browse request supports an 'offset=' argument to get more results. Browse requests also support 'limit=': the default limit is 25, and you can increase that up to 100\. 

**Special note for releases**: To ensure requests can complete without timing out, we limit the number of releases returned such that the entire list contains no more than 500 tracks. (However, at least one full release is always returned, even if it has more than 500 tracks; we don't return "partial" releases.) This means that you may not get 100 releases per page if you set `limit=100`; in fact the number will vary per page depending on the size of the releases. In order to page through the results properly, increment `offset` by the number of releases you get from each response, rather than the (larger, fixed) `limit` size. 

### inc=

Just like with normal lookup requests, the server can be instructed to include more data about the entity using an 'inc=' argument. Supported values for inc= are: 

 /ws/2/area              aliases
 /ws/2/artist            aliases
 /ws/2/event             aliases
 /ws/2/instrument        aliases
 /ws/2/label             aliases
 /ws/2/place             aliases
 /ws/2/recording         artist-credits, isrcs
 /ws/2/release           artist-credits, labels, recordings, release-groups, media, discids, isrcs (with recordings)
 /ws/2/release-group     artist-credits
 /ws/2/series            aliases
 /ws/2/work              aliases
 /ws/2/area              aliases
 /ws/2/url               (only relationship includes)

In addition to the inc= values listed above, all entities support: 

 annotation, tags, user-tags, genres, user-genres

All entities except area, place, release, and series support: 

 ratings, user-ratings

In addition, [Relationships](#Relationships) are available for all entity types via inc parameters, as with lookup requests. 

## Release (Group) Type and Status

Any query which includes release groups in the results can be filtered to only include release groups of a certain type. Any query which includes releases in the results can be filtered to only include releases of a certain type and/or status. Valid values are: 

 status     official, promotion, bootleg, pseudo-release, withdrawn, cancelled.
 type       album, single, ep, broadcast, other (primary types) / audio drama, audiobook, compilation, demo, dj-mix, field recording, interview, live, mixtape/street, remix, soundtrack, spokenword (secondary types).

See [the release status documentation](/doc/Release#Status) and [the release group type documentation](/doc/Release%5FGroup/Type) for info on what these values mean. 

Additionally, browsing release groups via artist supports a special filter to show the same release groups as in the default website overview (excluding ones that contain only releases of status promotional, bootleg or pseudo-release). Valid values are: 

 release-group-status     website-default, all

## Submitting data

You can use the API to submit certain kinds of data. Currently tags (including genres), ratings and ISRCs can be entered through the API. 

All POST requests require [authentication](#Authentication). 

POST requests should always include a 'client' parameter in the URL (not the body). The value of 'client' should be the ID of the client software submitting data. This has to be the application's name and version number, not that of a client library (client libraries should use HTTP's User-Agent header). The recommended format is "application-version", where version does not contain a - character. 

### User data

You can submit tags (including genres) and ratings through the **XML** API using POST requests. As described above, the client software needs to identify itself using the 'client=' parameter. In the following examples I will use 'example.app-0.4.7' as the client identifier; this is obviously a fictitious client. 

#### tags

To submit tags (including genres), perform a POST request to the /ws/2/tag url, like this: 

  /ws/2/tag?client=example.app-0.4.7

The body of your request should be an XML formatted list of entities with <user-tag> elements. 

An example request is reproduced below: 

<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">
    <artist-list>
        <artist id="a16d1433-ba89-4f72-a47b-a370add0bb56">
            <user-tag-list>
                <user-tag><name>female</name></user-tag>
                <user-tag><name>korean</name></user-tag>
                <user-tag><name>jpop</name></user-tag>
            </user-tag-list>
        </artist>
    </artist-list>
    <recording-list>
        <recording id="047ea202-b98d-46ae-97f7-0180a20ee5cf">
            <user-tag-list>
                <user-tag><name>noise</name></user-tag>
            </user-tag-list>
        </recording>
    </recording-list>
</metadata>

Because you're sending XML in the body of your POST request, make sure to also set the Content-Type to "application/xml; charset=utf-8". 

Our tag functionality includes the ability to upvote and downvote tags (including genres). This terminology can be confusing. Whenever you tag something, you are in fact "upvoting" it (which will add 1 to the vote count for the tag). Downvoting is the inverse operation, and will subtract 1 from the tag's vote count. Tags that you downvote will be hidden from the UI for you (and if their total vote count drops to 0 or below, they'll be hidden for everyone). The "user-tag" elements can include a "vote" attribute that specifies what action you want to take: 

<user-tag vote="upvote"><name>noise</name></user-tag>
<user-tag vote="downvote"><name>pop</name></user-tag>
<user-tag vote="withdraw"><name>rock</name></user-tag>

The "withdraw" vote will remove any upvote or downvote that you previously added (as if you had never voted). 

If you do not supply any "vote" attributes in your request (as in the example above), then the list of tags you submit will be treated as upvotes and will completely replace all existing upvoted tags you have on that entity. (So, tags that are not included in the request will be withdrawn, if they were previously upvoted. Downvoted tags are left in place.) This is a legacy behavior that we maintain from before we had tag voting. Including any "vote" attribute in the request will cause it to only apply those votes that you specified. 

#### ratings

To submit ratings, perform a POST request to the /ws/2/rating url, like this: 

  /ws/2/rating?client=example.app-0.4.7

The body of your request should be an XML formatted list of entities with <user-rating> elements. 

An example request is reproduced below: 

<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">
    <artist-list>
        <artist id="455641ea-fff4-49f6-8fb4-49f961d8f1ad">
            <user-rating>100</user-rating>
        </artist>
    </artist-list>
    <recording-list>
        <recording id="c410a773-c6eb-4bc0-9df8-042fe6645c63">
            <user-rating>20</user-rating>
        </recording>
    </recording-list>
</metadata>

#### collections

To add or remove releases (for example) from your collection, perform a PUT or DELETE request to /ws/2/collection/<gid>/releases, respectively: 

   PUT /ws/2/collection/f4784850-3844-11e0-9e42-0800200c9a66/releases/455641ea-fff4-49f6-8fb4-49f961d8f1ad;c410a773-c6eb-4bc0-9df8-042fe6645c63?client=example.app-0.4.7
   DELETE /ws/2/collection/f4784850-3844-11e0-9e42-0800200c9a66/releases/455641ea-fff4-49f6-8fb4-49f961d8f1ad;?client=example.app-0.4.7

Other types of entities supported by collections can be submitted, too; just substitute "releases" in the URI with one of: areas, artists, events, labels, places, recordings, release-groups, or works, depending on the type of collection. 

You may submit up to \~400 entities in a single request, separated by a semicolon (;), as the PUT example above shows. You are restricted to a maximum URI length of 16kb at the moment (which roughly equates to 400 gids). 

To get the description of a collection, perform a lookup request with the collection MBID: 

   GET /ws/2/collection/4a0a2cd0-3b20-4093-bd99-92788045845e

To get the description and the summarized contents of a collection, perform a lookup request with the collection MBID and the appropriate entity subquery: 

   GET /ws/2/collection/4a0a2cd0-3b20-4093-bd99-92788045845e/areas
   GET /ws/2/collection/f4784850-3844-11e0-9e42-0800200c9a66/releases
   ...

To get the contents of a collection, perform a browse request on the appropriate entity endpoint, using the collection MBID as a parameter: 

   GET /ws/2/area?collection=4a0a2cd0-3b20-4093-bd99-92788045845e
   GET /ws/2/release?collection=f4784850-3844-11e0-9e42-0800200c9a66
   ...

To get a list of collections for a given user (including the number of entities in each collection), you can browse the collection endpoint by editor name: 

   GET /ws/2/collection?editor=rob

This will only return collections that rob has made public. If you wish to see private collections as an authenticated user, do: 

   GET /ws/2/collection?editor=rob&inc=user-collections

### Barcode submission

Barcodes may be associated with releases by issuing an XML POST request to: 

   /ws/2/release/?client=example.app-0.4.7

The body of the request must be an XML document with a list of <releases>s in a <release-list>, and a single barcode in a <barcode> element for each release. For example: 

<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">
    <release-list>
        <release id="047ea202-b98d-46ae-97f7-0180a20ee5cf">
            <barcode>4050538793819</barcode>
        </release>
    </release-list>
</metadata>

Only GTIN (EAN/UPC) codes are accepted. Codes that have an incorrect check sum or a 2/5-digit add-on are refused. These should be manually added as annotation through the release editor instead. 

Upon issuing this request MusicBrainz will create a single edit in the edit queue for applying these changes. These changes will _not_ be automatically applied, though they will be applied if either no one votes against your changes, or once your changes expire. 

### ISRC submission

ISRCs may be associated with recordings by issuing an XML POST request to: 

   /ws/2/recording/?client=example.app-0.4.7

The body of the request must be an XML document with a list of <recording>s in a <recording-list>, and a list of <ISRC>s in a <isrc-list> to be associated with the recordings. For example: 

<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">
  <recording-list>
    <recording id="b9991644-7275-44db-bc43-fff6c6b4ce69">
      <isrc-list count="1">
        <isrc id="JPB600601201" />
      </isrc-list>
    </recording>
    <recording id="75c961c9-6e00-4861-9c9d-e6ca90d57342">
      <isrc-list count="1">
        <isrc id="JPB600523201" />
      </isrc-list>
    </recording>
  </recording-list>
</metadata>

## Libraries

It can be accessed with our C/C++ library, [libmusicbrainz](/doc/libmusicbrainz). 

**Third party libraries:**
* C#/Mono/.NET:  
   * [avatar29A/MusicBrainz](https://github.com/avatar29A/MusicBrainz)  
   * [MetaBrainz.MusicBrainz](https://github.com/Zastai/MetaBrainz.MusicBrainz) ([NuGet Package](https://www.nuget.org/packages/MetaBrainz.MusicBrainz))
* Common Lisp - [cl-musicbrainz](https://github.com/0/cl-musicbrainz)
* Go  
   * [github.com/michiwend/gomusicbrainz](https://github.com/michiwend/gomusicbrainz)  
   * [go.uploadedlobster.com/musicbrainzws2](https://git.sr.ht/~phw/go-musicbrainzws2)
* Haskell:  
   * [ClintAdams/MusicBrainz](http://hackage.haskell.org/package/MusicBrainz)  
   * [ocharles/musicbrainz-data](https://github.com/ocharles/haskell-musicbrainz-ws2)
* Java - [musicbrainzws2-java](http://code.google.com/p/musicbrainzws2-java/)
* JavaScript/Node.js:  
   * [musicbrainz-api](https://github.com/Borewit/musicbrainz-api)  
   * [node-musicbrainz](https://github.com/maxkueng/node-musicbrainz)
* Objective-C - [libmusicbrainz-objc](https://github.com/demosdemon/libmusicbrainz-objc)
* Perl - [WebService::MusicBrainz](https://metacpan.org/pod/WebService::MusicBrainz)
* PHP:  
   * [lachlan-00/MusicBrainz](https://github.com/lachlan-00/MusicBrainz), a fork of [mikealmond/MusicBrainz](https://github.com/mikealmond/MusicBrainz)  
   * [mikealmond/MusicBrainz](https://github.com/mikealmond/MusicBrainz), a fork of [phpbrainz](/doc/phpbrainz)  
   * [PBXg33k/MusicBrainz](https://github.com/PBXg33k/MusicBrainz)  
   * [stephan-strate/php-music-brainz-api](https://github.com/stephan-strate/php-music-brainz-api)
* Python - [python-musicbrainzngs](http://python-musicbrainzngs.readthedocs.org/)
* Ruby:  
   * [dwo/musicbrainz-ruby](https://github.com/dwo/musicbrainz-ruby)  
   * [magnolia-fan/musicbrainz](https://github.com/magnolia-fan/musicbrainz)
* Rust - musicbrainz\_rs: [Crate](https://crates.io/crates/musicbrainz%5Frs) ([GitHub](https://github.com/oknozor/musicbrainz%5Frs))

This page is [transcluded](/doc/WikiDocs) from revision [#78939](////wiki.musicbrainz.org/MusicBrainz%5FAPI?oldid=78939) of [MusicBrainz API](//wiki.musicbrainz.org/MusicBrainz%5FAPI).

[Donate](https://metabrainz.org/donate)[Wiki](//wiki.musicbrainz.org/)[Forums](https://community.metabrainz.org/)[Chat](/doc/Communication/ChatBrainz)[Bug tracker](http://tickets.metabrainz.org/)[Blog](https://blog.metabrainz.org/)[Mastodon](https://mastodon.social/@MusicBrainz)[Bluesky](https://bsky.app/profile/musicbrainz.org)[Use beta site](/set-beta-preference?returnto=%2Fdoc%2FMusicBrainz%5FAPI)

Brought to you by [MetaBrainz Foundation](https://metabrainz.org/) and our [sponsors](https://metabrainz.org/sponsors) and [supporters](https://metabrainz.org/supporters).