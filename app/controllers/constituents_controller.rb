class ConstituentsController < ApplicationController

  respond_to :html, :json
  skip_before_filter :verify_authenticity_token, only: [:search]


  def index
  end

  def map
    @admin = params[:admin] != nil
  end

  def search
    client = Elasticsearch::Client.new host: connection_string
    # puts "\n\n\n\n\n"
    # puts params
    # puts "\n\n\n\n\n"
    begin
      q = params[:q]
      filter_path = params[:filter_path]
      from = params[:from]
      size = params[:size]
      source = params[:source]
      type = params[:type]
      exclude = params[:source_exclude]
      sort = "AlphaSort.raw:asc"
      r = client.search index: 'pic', type: type, body: q, size: size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
    rescue
      @results = nil
    end
    if r
      # puts r
      # replace the addresses with the inner_hits
      @results = {
        hits: {
          total: r["hits"]["total"],
          hits: []
        }
      }
      # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
      # puts r
      r["hits"]["hits"].each do |hit|
        tmp = {
          _source: hit["_source"]
        }
        # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
        # puts hit
      #   # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
        if (hit["inner_hits"] != nil)
          tmp[:_source]["address"] = hit["inner_hits"]["address"]["hits"]["hits"].map { |a| a["_source"]}
        end
        @results[:hits][:hits].push(tmp)
      end
      # @results = r
    end
    render :json => @results
  end

  def export
    client = Elasticsearch::Client.new host: connection_string
    type = "json"
    if params[:type] != nil
      type = params[:type]
    end
    begin
      q = JSON.parse(params[:q])
      filter_path = params[:filter_path]
      from = 0
      size = 1000
      source = params[:source]
      exclude = params[:source_exclude]
      sort = "AlphaSort.raw:asc"
      r = client.search index: 'pic', type: "constituent", body: q, size: size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
    rescue
      @results = nil
    end
      puts r
    if r && r["hits"]["total"] > 0
      puts "fuck yeah"
      puts "type: #{params} |#{params[:type]==nil}|"
      temp = r["hits"]["hits"]
      if type == "json"
        @results = temp
      elsif type == "geojson"
        @results = {
          :type => "FeatureCollection", :features => []
        }
        temp.each do |hit|
          r = {}
          r[:type] = "Feature"
          r[:properties] = hit
          r[:geometry] = { :type => "MultiPoint", :coordinates => [] }
          next if hit["_source"]["address"] == nil
          hit["_source"]["address"].each do |address|
            r[:geometry][:coordinates].push([address["Location"]["lon"], address["Location"]["lat"]]) if address["Location"] != nil
          end
          @results[:features].push(r)
        end
      end
    end
    render :json => @results
  end

  def show
    client = Elasticsearch::Client.new host: connection_string
    begin
      results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    if results && results["hits"]["total"] > 0
      @constituent = results["hits"]["hits"][0]["_source"]
    end
    respond_with @constituent do |f|
      f.html {render json: @constituent}
      f.json
    end
  end

end
